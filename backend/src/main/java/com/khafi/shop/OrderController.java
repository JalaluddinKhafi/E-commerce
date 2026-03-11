package com.khafi.shop;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api")
class OrderController {
    record Checkout(@NotBlank @Size(max=500) String address, @NotBlank @Size(min=5, max=40) String phone,
                    @NotNull UUID requestKey, @Min(0) Integer expectedTotalCents, @Size(max=100) String recipient) {}
    record Status(@NotBlank String status) {}
    record LineView(Long productId, String name, String image, int priceCents, int quantity) {}
    record OrderView(Long id, Instant createdAt, String status, String address, String phone, String recipient,
                     int subtotalCents, int shippingCents, int totalCents, List<LineView> items) {
        static OrderView of(ShopOrder o) {
            return new OrderView(o.id, o.createdAt, o.status, o.address, o.phone, o.subtotalCents, o.shippingCents,
                o.totalCents, o.items.stream().map(i -> new LineView(i.productId, i.name, i.image, i.priceCents, i.quantity)).toList());
        }
    }
    private final Customers customers;
    private final Products products;
    private final Carts carts;
    private final Orders orders;
    private final OrderLifecycle lifecycle;
    @PersistenceContext private EntityManager entityManager;
    OrderController(Customers customers, Products products, Carts carts, Orders orders, OrderLifecycle lifecycle) {
        this.customers=customers; this.products=products; this.carts=carts; this.orders=orders;
        this.lifecycle=lifecycle;
    }
    @PostMapping("/orders") @ResponseStatus(HttpStatus.CREATED) @Transactional
    OrderView checkout(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Checkout data) {
        Long userId = Long.valueOf(jwt.getSubject());
        Customer user = customers.lock(userId).orElseThrow();
        // A retry after a lost response returns the original order instead of charging inventory twice.
        var previous = orders.findByCustomerIdAndRequestKey(userId, data.requestKey().toString());
        if (previous.isPresent()) return OrderView.of(previous.get());
        var cart = carts.findByCustomerIdOrderByIdAsc(userId);
        if (cart.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Your cart is empty");
        // All checkouts lock products in the same order to avoid overselling and deadlocks.
        var sorted = cart.stream().sorted(Comparator.comparing(i -> i.product.id)).toList();
        ShopOrder order = new ShopOrder();
        order.customer=user; order.requestKey=data.requestKey().toString();
        order.address=data.address().strip(); order.phone=data.phone().strip();
        long subtotal = 0;
        for (CartItem item : sorted) {
            Product p = products.lock(item.product.id).orElseThrow();
            // The cart already loaded this product. Reload after acquiring the row lock,
            // otherwise another checkout may have committed since that earlier read.
            entityManager.refresh(p, LockModeType.PESSIMISTIC_WRITE);
            if (!p.active || item.quantity > p.stock)
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Unavailable quantity for " + p.name + "; update your cart");
            OrderLine line = new OrderLine(); line.productId=p.id; line.name=p.name; line.image=p.image;
            line.priceCents=p.priceCents; line.quantity=item.quantity;
            order.items.add(line);
            subtotal += (long) p.priceCents * item.quantity;
            p.stock -= item.quantity;
        }
        if (subtotal > 100_000_000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order total exceeds the store limit");
        order.subtotalCents = (int) subtotal;
        order.shippingCents = CartController.shipping(order.subtotalCents);
        order.totalCents = order.subtotalCents + order.shippingCents;
        if (data.expectedTotalCents() != null && data.expectedTotalCents() != order.totalCents)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Prices have changed. Review the updated total and confirm again.");
        orders.saveAndFlush(order);
        carts.deleteByCustomerId(userId);
        return OrderView.of(order);
    }
    @GetMapping("/orders") @Transactional(readOnly=true)
    List<OrderView> mine(@AuthenticationPrincipal Jwt jwt) {
        return orders.findByCustomerIdOrderByCreatedAtDesc(Long.valueOf(jwt.getSubject())).stream().map(OrderView::of).toList();
    }
    @PostMapping("/orders/{id}/cancel") @Transactional
    OrderView cancel(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return OrderView.of(lifecycle.cancelForCustomer(Long.valueOf(jwt.getSubject()), id));
    }
    @GetMapping("/admin/orders") @Transactional(readOnly=true)
    List<OrderView> all() { return orders.findAllByOrderByCreatedAtDesc().stream().map(OrderView::of).toList(); }

    @PatchMapping("/admin/orders/{id}") @Transactional
    OrderView status(@PathVariable Long id, @Valid @RequestBody Status data) {
        ShopOrder order = orders.lock(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        return OrderView.of(lifecycle.change(order, data.status()));
    }
}
