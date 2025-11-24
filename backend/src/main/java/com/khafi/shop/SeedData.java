package com.khafi.shop;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class SeedData implements CommandLineRunner {
    private final Products products;
    private final Customers customers;
    private final PasswordEncoder passwords;
    private final String adminEmail;
    private final String adminPassword;
    SeedData(Products products, Customers customers, PasswordEncoder passwords,
             @Value("${shop.admin-email}") String adminEmail, @Value("${shop.admin-password}") String adminPassword) {
        this.products=products; this.customers=customers; this.passwords=passwords;
        this.adminEmail=adminEmail; this.adminPassword=adminPassword;
    }
    @Override @Transactional
    public void run(String... args) {
        if (products.count() == 0) {
            seed("Fresh carrots", "Sweet, crunchy carrots picked for your everyday cooking.", "Vegetables", "img-pro-01.jpg", 399, 60);
            seed("Garden tomatoes", "Ripe tomatoes, perfect for salads and homemade sauces.", "Vegetables", "img-pro-02.jpg", 499, 45);
            seed("Seedless grapes", "A juicy bunch of sweet grapes for a refreshing snack.", "Fruit", "img-pro-03.jpg", 699, 30);
            seed("Seasonal fruit box", "A handpicked selection of the season's freshest fruit.", "Fruit", "img-pro-04.jpg", 1299, 20);
        }
        if (!adminEmail.isBlank() || !adminPassword.isBlank()) {
            if (!adminEmail.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+") || adminPassword.length() < 12 || adminPassword.getBytes(StandardCharsets.UTF_8).length > 72)
                throw new IllegalStateException("Set a valid ADMIN_EMAIL and ADMIN_PASSWORD of 12–72 UTF-8 bytes");
            String email = adminEmail.strip().toLowerCase(Locale.ROOT);
            var existing = customers.findByEmail(email);
            if (existing.isPresent()) {
                if (!existing.get().role.equals("ADMIN")) throw new IllegalStateException("Admin email belongs to a customer; use a different email");
            } else {
                var admin = new Customer();
                admin.name = "Store manager"; admin.email=email; admin.role="ADMIN";
                admin.passwordHash=passwords.encode(adminPassword);
                customers.save(admin);
            }
        }
    }
    private void seed(String name, String description, String category, String image, int priceCents, int stock) {
        Product p = new Product(); p.name=name; p.description=description; p.category=category;
        p.image="/images/" + image; p.priceCents=priceCents; p.stock=stock;
        products.save(p);
    }
}
