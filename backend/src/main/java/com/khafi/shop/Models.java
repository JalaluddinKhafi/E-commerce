package com.khafi.shop;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

// Entities stay inside the persistence layer; API responses use explicit DTOs.
@Entity @Table(name = "customers")
class Customer {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @Column(nullable = false, unique = true, length = 254) String email;
    @Column(nullable = false) String name;
    @Column(nullable = false) String passwordHash;
    @Column(nullable = false) String role = "USER";
    @Column(nullable = false, columnDefinition = "bigint default 0") long tokenVersion;
}

@Entity
class Product {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @Column(nullable = false) String name;
    @Column(nullable = false, length = 2000) String description;
    @Column(nullable = false) String category;
    @Column(nullable = false) String image;
    int priceCents;
    int stock;
    boolean active = true;
}

@Entity @Table(uniqueConstraints = @UniqueConstraint(columnNames = {"customer_id", "product_id"}))
class CartItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY) Customer customer;
    @ManyToOne(optional = false) Product product;
    int quantity;
}

@Entity @Table(name = "shop_orders", uniqueConstraints = @UniqueConstraint(columnNames = {"customer_id", "requestKey"}))
class ShopOrder {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY) Customer customer;
    @Column(nullable = false, length = 36) String requestKey;
    @Column(nullable = false) Instant createdAt = Instant.now();
    @Column(nullable = false) String status = "PLACED";
    @Column(nullable = false, length = 500) String address;
    @Column(nullable = false, length = 40) String phone;
    @Column(length = 100) String recipient;
    int subtotalCents;
    int shippingCents;
    int totalCents;
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "order_id", nullable = false)
    @OrderBy("id ASC") List<OrderLine> items = new ArrayList<>();
}

@Entity
class OrderLine {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    Long productId;
    String name;
    String image;
    int priceCents;
    int quantity;
}
