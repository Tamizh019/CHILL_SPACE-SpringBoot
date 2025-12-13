package com.chillspace.backend.controller;

import com.chillspace.backend.model.User;
import com.chillspace.backend.repository.MessageRepository;
import com.chillspace.backend.repository.UserRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final MessageRepository messageRepository;

    @GetMapping
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    @PutMapping("/profile")
    @Transactional
    public ResponseEntity<?> updateProfile(@RequestBody UpdateProfileRequest request, Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String oldUsername = principal.getName();
        User user = userRepository.findByUsername(oldUsername)
                .orElseThrow(() -> new RuntimeException("User not found"));

        boolean usernameChanged = false;

        if (request.getUsername() != null && !request.getUsername().isBlank()) {
            String newUsername = request.getUsername().trim();
            if (!oldUsername.equals(newUsername)) {
                // Check if new username is taken
                if (userRepository.existsByUsername(newUsername)) {
                    return ResponseEntity.badRequest().body(Map.of("message", "Username already taken"));
                }

                // Update all old messages to use new username
                int updatedMessages = messageRepository.updateSenderUsername(oldUsername, newUsername);
                System.out.println(
                        "Updated " + updatedMessages + " messages from '" + oldUsername + "' to '" + newUsername + "'");

                user.setUsername(newUsername);
                usernameChanged = true;
            }
        }

        // Update avatar style if provided
        if (request.getAvatarStyle() != null && !request.getAvatarStyle().isBlank()) {
            user.setAvatarStyle(request.getAvatarStyle().trim());
        }

        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "message", "Profile updated successfully",
                "usernameChanged", usernameChanged,
                "newUsername", user.getUsername(),
                "avatarStyle", user.getAvatarStyle() != null ? user.getAvatarStyle() : "initials"));
    }

    @Data
    static class UpdateProfileRequest {
        private String username;
        private String avatarStyle;
    }
}
