package com.khafi.shop;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.server.resource.authentication.*;
import org.springframework.security.web.SecurityFilterChain;

@Configuration @EnableMethodSecurity
class SecurityConfig {
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }

    @Bean SecretKey jwtKey(@Value("${shop.jwt-secret}") String configured) {
        byte[] key;
        if (configured.isBlank()) {
            key = new byte[32];
            new SecureRandom().nextBytes(key);
            LoggerFactory.getLogger(SecurityConfig.class).warn("JWT_SECRET is unset: using a temporary development key; restarting signs users out.");
        } else {
            key = configured.getBytes(StandardCharsets.UTF_8);
            if (key.length < 32) throw new IllegalStateException("JWT_SECRET must contain at least 32 UTF-8 bytes");
        }
        return new SecretKeySpec(key, "HmacSHA256");
    }

    @Bean JwtEncoder jwtEncoder(SecretKey key) { return new NimbusJwtEncoder(new ImmutableSecret<>(key)); }
    @Bean JwtDecoder jwtDecoder(SecretKey key, Customers customers) {
        var decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        OAuth2TokenValidator<Jwt> accountValidator = jwt -> {
            try {
                var account = customers.findById(Long.valueOf(jwt.getSubject()));
                Object claim = jwt.getClaim("version");
                // Existing version-zero JWTs remain usable until credentials are changed.
                long version = claim == null ? 0 : ((Number) claim).longValue();
                if (account.isPresent() && account.get().tokenVersion == version
                    && account.get().role.equals(jwt.getClaimAsString("role")))
                    return OAuth2TokenValidatorResult.success();
            } catch (IllegalArgumentException | ClassCastException ignored) {
                // Invalid claims are authentication failures, never application errors.
            }
            return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Session has been revoked", null));
        };
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer("freshshop"), accountValidator));
        return decoder;
    }

    @Bean SecurityFilterChain security(HttpSecurity http) throws Exception {
        var authorities = new JwtGrantedAuthoritiesConverter();
        authorities.setAuthoritiesClaimName("role");
        authorities.setAuthorityPrefix("ROLE_");
        var converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(authorities);
        return http
            // Only Authorization bearer tokens are accepted, never authentication cookies.
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/products", "/api/products/*", "/api/catalog", "/api/health").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())
            .oauth2ResourceServer(resource -> resource.jwt(jwt -> jwt.jwtAuthenticationConverter(converter)))
            .build();
    }
}
