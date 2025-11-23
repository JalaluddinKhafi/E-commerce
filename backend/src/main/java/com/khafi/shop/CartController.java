package com.khafi.shop;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/cart")
class CartController {
    record Quantity(@Min(0) @Max(99) int quantity) {}
    record CartLine(CatalogController.ProductView product, int quantity) {}
    record CartView(List<CartLine> items, int subtotalCents, int shippingCents, int totalCents) {}
    private final Customers customers;
    private final Products products;
    private final Carts carts;
    CartController(Customers customers, Products products, Carts carts) { this.customers=customers; this.products=products; this.carts=carts; }

    @GetMapping @Transactional(readOnly=true)
    CartView get(@AuthenticationPrincipal Jwt jwt) { return view(Long.valueOf(jwt.getSubject())); }

    @PutMapping("/{productId}") @Transactional
    CartView set(@AuthenticationPrincipal Jwt jwt, @PathVariable Long productId, @Valid @RequestBody Quantity data) {
        Long userId = Long.valueOf(jwt.getSubject());
        // Serialize cart writes with checkout so a purchased cart cannot be modified halfway through.
        Customer user = customers.lock(userId).orElseThrow();
        var existing = carts.findByCustomerIdAndProductId(userId, productId);
        if (data.quantity() == 0) { existing.ifPresent(carts::delete); carts.flush(); return view(userId); }
        Product product = products.findById(productId).filter(p -> p.active).orElseThrow(
            () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
        if (data.quantity() > product.stock) throw new ResponseStatusException(HttpStatus.CONFLICT, "Not enough stock for " + product.name);
        CartItem item = existing.orElseGet(CartItem::new);
        item.customer = user; item.product = product; item.quantity = data.quantity();
        carts.saveAndFlush(item);
        return view(userId);
    }
    CartView view(Long userId) {
        var lines = carts.findByCustomerIdOrderByIdAsc(userId).stream()
            .map(i -> new CartLine(CatalogController.ProductView.of(i.product), i.quantity)).toList();
        long amount = lines.stream().mapToLong(i -> (long) i.product().priceCents() * i.quantity()).sum();
        if (amount > 100_000_000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cart total exceeds the store limit");
        int subtotal = (int) amount;
        int shipping = shipping(subtotal);
        return new CartView(lines, subtotal, shipping, Math.addExact(subtotal, shipping));
    }
    static int shipping(int subtotal) { return subtotal == 0 || subtotal >= 5000 ? 0 : 500; }
}
