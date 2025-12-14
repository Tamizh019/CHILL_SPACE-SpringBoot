package com.chillspace.backend.controller;

import com.chillspace.backend.model.ProfileImage;
import com.chillspace.backend.model.User;
import com.chillspace.backend.repository.MessageRepository;
import com.chillspace.backend.repository.ProfileImageRepository;
import com.chillspace.backend.repository.UserRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final ProfileImageRepository profileImageRepository;

    @GetMapping
    public List<Map<String, Object>> getAllUsers() {
        List<User> users = userRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        
        for (User user : users) {
            Map<String, Object> userMap = new HashMap<>();
            userMap.put("id", user.getId());
            userMap.put("username", user.getUsername());
            userMap.put("email", user.getEmail());
            userMap.put("role", user.getRole());
            userMap.put("avatarStyle", user.getAvatarStyle());
            userMap.put("hasProfileImage", profileImageRepository.existsByUserId(user.getId()));
            userMap.put("createdAt", user.getCreatedAt());
            userMap.put("isOnline", user.isOnline());
            result.add(userMap);
        }
        
        return result;
    }

    @PostMapping("/avatar")
    @Transactional
    public ResponseEntity<?> uploadAvatar(@RequestParam("file") MultipartFile file, Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "No file uploaded"));
            }

            String contentType = file.getContentType();
            if (contentType == null || !contentType.startsWith("image/")) {
                return ResponseEntity.badRequest().body(Map.of("message", "Only image files are allowed"));
            }

            if (file.getSize() > 5 * 1024 * 1024) {
                return ResponseEntity.badRequest().body(Map.of("message", "File size must be less than 5MB"));
            }

            User user = userRepository.findByUsername(principal.getName())
                    .orElseThrow(() -> new RuntimeException("User not found"));

            String base64Image = Base64.getEncoder().encodeToString(file.getBytes());

            // Save to separate profile_images table
            Optional<ProfileImage> existingImage = profileImageRepository.findByUserId(user.getId());
            ProfileImage profileImage;
            if (existingImage.isPresent()) {
                profileImage = existingImage.get();
                profileImage.setImageData(base64Image);
                profileImage.setImageType(contentType);
            } else {
                profileImage = new ProfileImage();
                profileImage.setUser(user);
                profileImage.setImageData(base64Image);
                profileImage.setImageType(contentType);
            }
            profileImageRepository.save(profileImage);

            return ResponseEntity.ok(Map.of(
                    "message", "Avatar uploaded successfully",
                    "hasProfileImage", true
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to upload avatar: " + e.getMessage()));
        }
    }

    @GetMapping("/{username}/avatar")
    public ResponseEntity<?> getAvatar(@PathVariable String username) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        Optional<ProfileImage> profileImageOpt = profileImageRepository.findByUserId(user.getId());
        
        if (profileImageOpt.isEmpty() || profileImageOpt.get().getImageData() == null) {
            return ResponseEntity.notFound().build();
        }

        try {
            ProfileImage profileImage = profileImageOpt.get();
            byte[] imageBytes = Base64.getDecoder().decode(profileImage.getImageData());
            MediaType mediaType = MediaType.parseMediaType(
                    profileImage.getImageType() != null ? profileImage.getImageType() : "image/png"
            );
            
            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .body(imageBytes);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{username}/stats")
    public ResponseEntity<?> getUserStats(@PathVariable String username) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        long messageCount = messageRepository.countBySender(username);
        long daysActive = ChronoUnit.DAYS.between(user.getCreatedAt(), LocalDateTime.now());
        if (daysActive < 1) daysActive = 1;

        return ResponseEntity.ok(Map.of(
                "username", username,
                "messageCount", messageCount,
                "daysActive", daysActive,
                "role", user.getRole(),
                "createdAt", user.getCreatedAt(),
                "hasProfileImage", profileImageRepository.existsByUserId(user.getId())
        ));
    }

    @DeleteMapping("/avatar")
    @Transactional
    public ResponseEntity<?> deleteAvatar(Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        User user = userRepository.findByUsername(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        profileImageRepository.deleteByUserId(user.getId());

        return ResponseEntity.ok(Map.of("message", "Avatar removed"));
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
                if (userRepository.existsByUsername(newUsername)) {
                    return ResponseEntity.badRequest().body(Map.of("message", "Username already taken"));
                }

                int updatedMessages = messageRepository.updateSenderUsername(oldUsername, newUsername);
                System.out.println("Updated " + updatedMessages + " messages from '" + oldUsername + "' to '" + newUsername + "'");

                user.setUsername(newUsername);
                usernameChanged = true;
            }
        }

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


