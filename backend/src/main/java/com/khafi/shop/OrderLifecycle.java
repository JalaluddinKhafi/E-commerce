package com.khafi.shop;

import java.util.Comparator;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
class OrderLifecycle {
    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
        "PLACED", Set.of("PROCESSING", "CANCELLED"),
        "PROCESSING", Set.of("SHIPPED", "CANCELLED"),
        "SHIPPED", Set.of("DELIVERED"));
    private final Products products;
    private final Orders orders;

    OrderLifecycle(Products products, Orders orders) { this.products = products; this.orders = orders; }

    @Transactional
    ShopOrder cancelForCustomer(Long customerId, Long orderId) {
        ShopOrder order = orders.lockForCustomer(orderId, customerId).orElseThrow(
            () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (order.status.equals("CANCELLED")) return order;
        if (!order.status.equals("PLACED"))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This order is already being prepared. Contact the store to request cancellation.");
        return change(order, "CANCELLED");
    }

    @Transactional
    ShopOrder change(ShopOrder order, String status) {
        if (order.status.equals(status)) return order;
        if (!TRANSITIONS.getOrDefault(order.status, Set.of()).contains(status))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Invalid order status transition");
        if (status.equals("CANCELLED")) {
            order.items.stream().sorted(Comparator.comparing(i -> i.productId)).forEach(line -> {
                Product product = products.lock(line.productId).orElseThrow();
                product.stock = Math.addExact(product.stock, line.quantity);
            });
        }
        order.status = status;
        return order;
    }
}
