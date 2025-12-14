package com.chillspace.backend.controller;

import com.chillspace.backend.controller.dto.AuthResponse;
import com.chillspace.backend.controller.dto.LoginRequest;
import com.chillspace.backend.controller.dto.RegisterRequest;
import com.chillspace.backend.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            return ResponseEntity.ok(authService.login(request));
        } catch (org.springframework.security.authentication.LockedException e) {
            return ResponseEntity.status(403).body(java.util.Map.of("message", "Account is banned. Contact admin."));
        } catch (org.springframework.security.authentication.DisabledException e) {
            return ResponseEntity.status(403).body(java.util.Map.of("message", "Account is disabled."));
        } catch (org.springframework.security.authentication.BadCredentialsException e) {
            return ResponseEntity.status(401).body(java.util.Map.of("message", "Invalid username or password"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(java.util.Map.of("message", "Login failed: " + e.getMessage()));
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        authService.register(request);
        return ResponseEntity.ok("User registered successfully!");
    }
}
