package com.khafi.shop;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/account")
class AccountController {
    record Profile(@NotBlank @Size(max = 100) String name) {}
    record PasswordChange(@NotBlank @Size(max = 72) String currentPassword,
                          @NotBlank @Size(min = 12, max = 72) String newPassword) {}
    private final Customers customers;
    private final PasswordEncoder passwords;

    AccountController(Customers customers, PasswordEncoder passwords) {
        this.customers = customers;
        this.passwords = passwords;
    }

    @PutMapping("/profile") @Transactional
    AuthController.UserView profile(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Profile data) {
        Customer user = lockedAccount(jwt);
        user.name = data.name().strip();
        return AuthController.UserView.of(user);
    }

    @PostMapping("/password") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    void password(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PasswordChange data) {
        Customer user = lockedAccount(jwt);
        if (data.currentPassword().getBytes(StandardCharsets.UTF_8).length > 72
            || !passwords.matches(data.currentPassword(), user.passwordHash))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
        if (data.newPassword().getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New password exceeds 72 UTF-8 bytes");
        if (passwords.matches(data.newPassword(), user.passwordHash))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a different password");
        user.passwordHash = passwords.encode(data.newPassword());
        user.tokenVersion = Math.incrementExact(user.tokenVersion);
    }

    @PostMapping("/logout-all") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    void logoutAll(@AuthenticationPrincipal Jwt jwt) {
        Customer user = lockedAccount(jwt);
        user.tokenVersion = Math.incrementExact(user.tokenVersion);
    }

    private Customer lockedAccount(Jwt jwt) {
        Customer user = customers.lock(Long.valueOf(jwt.getSubject())).orElseThrow(
            () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account not found"));
        Number claim = jwt.getClaim("version");
        long version = claim == null ? 0 : claim.longValue();
        if (version != user.tokenVersion || !Objects.equals(user.role, jwt.getClaimAsString("role")))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session has been revoked");
        return user;
    }
}
