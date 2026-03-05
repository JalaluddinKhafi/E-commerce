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
