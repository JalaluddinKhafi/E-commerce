package com.khafi.shop;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/auth")
class AuthController {
    record Registration(@NotBlank @Size(max=100) String name, @NotBlank @Email @Size(max=254) String email,
                        @NotBlank @Size(min=12, max=72) String password) {}
    record Login(@NotBlank @Email @Size(max=254) String email, @NotBlank @Size(max=72) String password) {}
    record UserView(Long id, String name, String email, String role) {
        static UserView of(Customer user) { return new UserView(user.id, user.name, user.email, user.role); }
    }
    record Session(String token, UserView user) {}
    private final Customers customers;
    private final PasswordEncoder passwords;
    private final JwtEncoder tokens;
    AuthController(Customers customers, PasswordEncoder passwords, JwtEncoder tokens) {
        this.customers = customers; this.passwords = passwords; this.tokens = tokens;
    }

    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED) @Transactional
    Session register(@Valid @RequestBody Registration data) {
        String email = data.email().strip().toLowerCase(Locale.ROOT);
        if (data.name().isBlank() || data.password().getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name or password is invalid");
        if (customers.findByEmail(email).isPresent())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        Customer user = new Customer();
        user.name = data.name().strip(); user.email = email;
        user.passwordHash = passwords.encode(data.password());
        return session(customers.saveAndFlush(user));
    }

    @PostMapping("/login")
    Session login(@Valid @RequestBody Login data) {
        var user = customers.findByEmail(data.email().strip().toLowerCase(Locale.ROOT));
        // Always perform a BCrypt comparison, including for unknown users.
        String hash = user.map(c -> c.passwordHash).orElse(DUMMY_HASH);
        boolean validLength = data.password().getBytes(StandardCharsets.UTF_8).length <= 72;
        boolean matches = passwords.matches(validLength ? data.password() : "", hash);
        if (user.isEmpty() || !validLength || !matches)
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect");
        return session(user.get());
    }

    @GetMapping("/me")
    UserView me(@AuthenticationPrincipal Jwt jwt) {
        return UserView.of(customers.findById(Long.valueOf(jwt.getSubject())).orElseThrow(
            () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account not found")));
    }

    private Session session(Customer user) {
        Instant now = Instant.now();
        var claims = JwtClaimsSet.builder().issuer("freshshop").subject(user.id.toString())
            .issuedAt(now).expiresAt(now.plusSeconds(3600)).claim("role", user.role)
            .claim("version", user.tokenVersion).build();
        String token = tokens.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        return new Session(token, UserView.of(user));
    }
    private static final String DUMMY_HASH = new BCryptPasswordEncoder().encode("not-a-real-account-password");
}
