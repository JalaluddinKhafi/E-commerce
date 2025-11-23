package com.khafi.shop;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api")
class CatalogController {
    record ProductView(Long id, String name, String description, String category, String image, int priceCents, int stock, boolean active) {
        static ProductView of(Product p) { return new ProductView(p.id, p.name, p.description, p.category, p.image, p.priceCents, p.stock, p.active); }
    }
    record ProductInput(@NotBlank @Size(max=120) String name, @NotBlank @Size(max=2000) String description,
                        @NotBlank @Size(max=60) String category,
                        @NotBlank @Pattern(regexp="/images/[a-zA-Z0-9_-]+\\.(jpg|jpeg|png|webp)") String image,
                        @Min(1) @Max(1000000) int priceCents, @Min(0) @Max(100000) int stock, boolean active) {}
    private final Products products;
    CatalogController(Products products) { this.products = products; }

    @GetMapping("/health") Map<String, String> health() { return Map.of("status", "ok"); }
    @GetMapping("/products") @Transactional(readOnly=true)
    List<ProductView> catalog() { return products.findByActiveTrueOrderByIdAsc().stream().map(ProductView::of).toList(); }
    @GetMapping("/products/{id}") @Transactional(readOnly=true)
    ProductView detail(@PathVariable Long id) {
        return ProductView.of(products.findById(id).filter(p -> p.active).orElseThrow(() -> missing()));
    }
    @GetMapping("/admin/products") @Transactional(readOnly=true)
    List<ProductView> all() { return products.findAll().stream().map(ProductView::of).toList(); }
    @PostMapping("/admin/products") @ResponseStatus(HttpStatus.CREATED) @Transactional
    ProductView create(@Valid @RequestBody ProductInput data) { return ProductView.of(products.save(assign(new Product(), data))); }
    @PutMapping("/admin/products/{id}") @Transactional
    ProductView update(@PathVariable Long id, @Valid @RequestBody ProductInput data) {
        return ProductView.of(assign(products.lock(id).orElseThrow(() -> missing()), data));
    }
    @DeleteMapping("/admin/products/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    void archive(@PathVariable Long id) { products.lock(id).orElseThrow(() -> missing()).active = false; }
    private Product assign(Product p, ProductInput d) {
        p.name = d.name().strip(); p.description = d.description().strip(); p.category = d.category().strip();
        p.image = d.image(); p.priceCents = d.priceCents(); p.stock = d.stock(); p.active = d.active();
        return p;
    }
    private ResponseStatusException missing() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"); }
}
