package com.khafi.shop;

import jakarta.persistence.*;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

@Entity @Table(uniqueConstraints = @UniqueConstraint(columnNames = {"customer_id", "product_id"}))
class SavedProduct {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY) Customer customer;
    @ManyToOne(optional = false) Product product;
