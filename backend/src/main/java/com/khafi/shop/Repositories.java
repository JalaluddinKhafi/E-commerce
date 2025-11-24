package com.khafi.shop;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

interface Customers extends JpaRepository<Customer, Long> {
    Optional<Customer> findByEmail(String email);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select c from Customer c where c.id = :id")
    Optional<Customer> lock(@Param("id") Long id);
}

interface Products extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {
    List<Product> findByActiveTrueOrderByIdAsc();
    @Query("select distinct p.category from Product p where p.active = true order by p.category")
    List<String> activeCategories();
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select p from Product p where p.id = :id")
    Optional<Product> lock(@Param("id") Long id);
}

interface Carts extends JpaRepository<CartItem, Long> {
    List<CartItem> findByCustomerIdOrderByIdAsc(Long customerId);
    Optional<CartItem> findByCustomerIdAndProductId(Long customerId, Long productId);
    void deleteByCustomerId(Long customerId);
}

interface Orders extends JpaRepository<ShopOrder, Long> {
    List<ShopOrder> findByCustomerIdOrderByCreatedAtDesc(Long customerId);
    List<ShopOrder> findAllByOrderByCreatedAtDesc();
    Optional<ShopOrder> findByCustomerIdAndRequestKey(Long customerId, String requestKey);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select o from ShopOrder o where o.id = :id")
    Optional<ShopOrder> lock(@Param("id") Long id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from ShopOrder o where o.id = :id and o.customer.id = :customerId")
    Optional<ShopOrder> lockForCustomer(@Param("id") Long id, @Param("customerId") Long customerId);
}
