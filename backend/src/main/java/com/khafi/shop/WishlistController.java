package com.khafi.shop;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.HashSet;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/wishlist")
class WishlistController {
    record Import(@NotNull @Size(max = 100) List<@NotNull @Positive Long> productIds) {}
    private final Customers customers;
    private final Products products;
    private final SavedProducts saved;

    WishlistController(Customers customers, Products products, SavedProducts saved) {
        this.customers = customers; this.products = products; this.saved = saved;
    }
    @GetMapping @Transactional(readOnly = true)
    List<CatalogController.ProductView> get(@AuthenticationPrincipal Jwt jwt) {
        return views(Long.valueOf(jwt.getSubject()));
    }
    @PutMapping("/{productId}") @Transactional
    List<CatalogController.ProductView> add(@AuthenticationPrincipal Jwt jwt, @PathVariable Long productId) {
        Long id = Long.valueOf(jwt.getSubject());
        Customer customer = customers.lock(id).orElseThrow();
        if (saved.findByCustomerIdAndProductId(id, productId).isEmpty()) {
            Product product = products.findById(productId).filter(p -> p.active).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
            if (saved.countByCustomerId(id) >= 100) throw limit();
            save(customer, product);
        }
        return views(id);
    }
    @DeleteMapping("/{productId}") @Transactional
    List<CatalogController.ProductView> remove(@AuthenticationPrincipal Jwt jwt, @PathVariable Long productId) {
        Long id = Long.valueOf(jwt.getSubject());
        customers.lock(id).orElseThrow();
        saved.findByCustomerIdAndProductId(id, productId).ifPresent(saved::delete);
        saved.flush();
        return views(id);
    }
    @PostMapping("/import") @Transactional
    List<CatalogController.ProductView> merge(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Import data) {
        Long id = Long.valueOf(jwt.getSubject());
        Customer customer = customers.lock(id).orElseThrow();
        var existing = saved.findByCustomerIdOrderByIdAsc(id);
        var ids = new HashSet<Long>();
        existing.forEach(item -> ids.add(item.product.id));
        var additions = products.findAllById(new HashSet<>(data.productIds())).stream()
            .filter(p -> p.active && !ids.contains(p.id)).toList();
        if (existing.size() + additions.size() > 100) throw limit();
        additions.forEach(p -> save(customer, p));
