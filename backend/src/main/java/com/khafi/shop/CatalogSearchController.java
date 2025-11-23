package com.khafi.shop;

import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/catalog")
class CatalogSearchController {
    record CatalogPage(List<CatalogController.ProductView> items, long totalElements,
                       int totalPages, int page, int size, List<String> categories) {}
    private final Products products;
    CatalogSearchController(Products products) { this.products = products; }

    @GetMapping @Transactional(readOnly = true)
    CatalogPage search(@RequestParam(defaultValue = "") String q,
                       @RequestParam(defaultValue = "") String category,
                       @RequestParam(defaultValue = "featured") String sort,
                       @RequestParam(defaultValue = "0") int page,
                       @RequestParam(defaultValue = "12") int size) {
        if (q.length() > 120 || category.length() > 60 || page < 0 || page > 100000 || size < 1 || size > 48)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid catalog filters or page size");
        Sort ordering = switch (sort) {
            case "featured" -> Sort.by("id");
            case "low" -> Sort.by("priceCents").ascending().and(Sort.by("id"));
            case "high" -> Sort.by("priceCents").descending().and(Sort.by("id"));
            case "name" -> Sort.by("name").ascending().and(Sort.by("id"));
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown catalog sort order");
        };
        String text = q.strip().toLowerCase(Locale.ROOT);
        String selected = category.strip().toLowerCase(Locale.ROOT);
        // Treat SQL LIKE metacharacters as literal search text supplied by the shopper.
        String pattern = "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        Specification<Product> filters = (root, query, builder) -> {
            var conditions = new ArrayList<Predicate>();
            conditions.add(builder.isTrue(root.get("active")));
            if (!selected.isEmpty()) conditions.add(builder.equal(builder.lower(root.get("category")), selected));
            if (!text.isEmpty()) conditions.add(builder.or(
                builder.like(builder.lower(root.get("name")), pattern, '\\'),
                builder.like(builder.lower(root.get("description")), pattern, '\\'),
                builder.like(builder.lower(root.get("category")), pattern, '\\')));
            return builder.and(conditions.toArray(Predicate[]::new));
        };
        var results = products.findAll(filters, PageRequest.of(page, size, ordering));
        return new CatalogPage(results.getContent().stream().map(CatalogController.ProductView::of).toList(),
            results.getTotalElements(), results.getTotalPages(), page, size, products.activeCategories());
    }
}
