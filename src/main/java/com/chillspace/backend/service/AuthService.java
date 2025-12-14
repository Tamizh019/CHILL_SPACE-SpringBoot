package com.chillspace.backend.service;

import com.chillspace.backend.controller.dto.AuthResponse;
import com.chillspace.backend.controller.dto.LoginRequest;
import com.chillspace.backend.controller.dto.RegisterRequest;
import com.chillspace.backend.model.User;
import com.chillspace.backend.repository.UserRepository;
import com.chillspace.backend.security.JwtUtils;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;

    public AuthService(AuthenticationManager authenticationManager, UserRepository userRepository,
            PasswordEncoder passwordEncoder, JwtUtils jwtUtils) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtils = jwtUtils;
    }

    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);

        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // ...
        String role = user.getRole().name();
        String token = jwtUtils.generateToken(user.getUsername(), role);

        return new AuthResponse(token, user.getUsername(), role, user.getId());
    }

    @org.springframework.beans.factory.annotation.Value("${supabase.url}")
    private String supabaseUrl;

    @org.springframework.beans.factory.annotation.Value("${supabase.key}")
    private String supabaseKey;

    private void validateSupabaseToken(String token, String email) {
        if (token == null || token.isEmpty()) {
            throw new RuntimeException("Email verification required");
        }
        try {
            java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
            String validationUrl = supabaseUrl + "/auth/v1/user";
            
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(validationUrl))
                    .header("Authorization", "Bearer " + token)
                    .header("apikey", supabaseKey)
                    .GET()
                    .build();

            java.net.http.HttpResponse<String> response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                throw new RuntimeException("Invalid verification token");
            }

            // Simple check to ensure token belongs to the email
            if (!response.body().contains(email)) {
                throw new RuntimeException("Token email mismatch");
            }
        } catch (Exception e) {
            throw new RuntimeException("Verification failed: " + e.getMessage());
        }
    }

    public void register(RegisterRequest request) {
        // Verify OTP Token first
        validateSupabaseToken(request.getSupabaseAccessToken(), request.getEmail());

        if (userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("Username is already taken!");
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email is already in use!");
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(com.chillspace.backend.model.Role.USER);

        userRepository.save(user);
    }
}
