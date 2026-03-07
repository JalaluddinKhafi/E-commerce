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

@RestController @RequestMapping("/api/account/addresses")
class AddressController {
    record Input(@NotBlank @Size(max = 40) String label,
                 @NotBlank @Size(max = 100) String recipient,
                 @NotBlank @Size(min = 5, max = 40) String phone,
                 @NotBlank @Size(max = 500) String address, boolean isDefault) {}
    record View(Long id, String label, String recipient, String phone, String address, boolean isDefault) {
        static View of(DeliveryAddress a) { return new View(a.id, a.label, a.recipient, a.phone, a.address, a.isDefault); }
    }
    private final Customers customers;
    private final DeliveryAddresses addresses;
    AddressController(Customers customers, DeliveryAddresses addresses) { this.customers = customers; this.addresses = addresses; }

    @GetMapping @Transactional(readOnly = true)
    List<View> list(@AuthenticationPrincipal Jwt jwt) {
        return addresses.findByCustomerIdOrderByIdAsc(Long.valueOf(jwt.getSubject())).stream().map(View::of).toList();
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) @Transactional
    View create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Input input) {
        Long id = Long.valueOf(jwt.getSubject());
        Customer customer = customers.lock(id).orElseThrow();
        if (addresses.countByCustomerId(id) >= 10)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account can save at most ten addresses");
        var entry = new DeliveryAddress(); entry.customer = customer;
        assign(entry, input);
        selectDefault(id, entry, input.isDefault());
        return View.of(addresses.saveAndFlush(entry));
    }
    @PutMapping("/{addressId}") @Transactional
    View update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long addressId, @Valid @RequestBody Input input) {
        Long id = Long.valueOf(jwt.getSubject());
        customers.lock(id).orElseThrow();
        DeliveryAddress entry = owned(addressId, id);
        assign(entry, input);
        selectDefault(id, entry, input.isDefault());
        return View.of(entry);
    }
    @DeleteMapping("/{addressId}") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long addressId) {
        Long id = Long.valueOf(jwt.getSubject());
        customers.lock(id).orElseThrow();
        DeliveryAddress entry = owned(addressId, id);
        boolean wasDefault = entry.isDefault;
        addresses.delete(entry); addresses.flush();
        if (wasDefault) addresses.findByCustomerIdOrderByIdAsc(id).stream().findFirst().ifPresent(a -> a.isDefault = true);
    }
    private DeliveryAddress owned(Long addressId, Long customerId) {
        return addresses.findByIdAndCustomerId(addressId, customerId).orElseThrow(
