package com.chillspace.backend.controller;

import com.chillspace.backend.model.Role;
import com.chillspace.backend.model.User;
import com.chillspace.backend.repository.MessageRepository;
import com.chillspace.backend.repository.SharedFileRepository;
import com.chillspace.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final SharedFileRepository fileRepository;

    private final org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;

    // Helper to broadcast updates
    private void broadcastUserUpdate(User user) {
        com.chillspace.backend.model.Message updateMsg = new com.chillspace.backend.model.Message();
        updateMsg.setType(com.chillspace.backend.model.MessageType.USER_UPDATE);
        updateMsg.setSender(user.getUsername());
        updateMsg.setSenderRole(user.getRole());
        updateMsg.setContent("User updated"); // Optional content
        messagingTemplate.convertAndSend("/topic/public", updateMsg);
    }

    /**
     * Get dashboard statistics
     */
    @GetMapping("/stats")
    public ResponseEntity<?> getDashboardStats(Principal principal) {
        if (!isAdmin(principal)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Admin access required"));
        }

        long totalUsers = userRepository.count();
        long totalMessages = messageRepository.count();
        long totalFiles = fileRepository.count();
        long onlineUsers = userRepository.countByIsOnline(true);
        long bannedUsers = userRepository.countByIsBanned(true);

        // Messages today
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        long messagesToday = messageRepository.countByTimestampAfter(startOfDay);

        // New users this week
        LocalDateTime weekAgo = LocalDateTime.now().minusDays(7);
        long newUsersThisWeek = userRepository.countByCreatedAtAfter(weekAgo);

        // Calculate storage used (approximate from file sizes)
        Long storageUsed = fileRepository.sumFileSizes();
        if (storageUsed == null) storageUsed = 0L;

        return ResponseEntity.ok(Map.of(
                "totalUsers", totalUsers,
                "totalMessages", totalMessages,
                "totalFiles", totalFiles,
                "onlineUsers", onlineUsers,
                "bannedUsers", bannedUsers,
                "messagesToday", messagesToday,
                "newUsersThisWeek", newUsersThisWeek,
                "storageUsed", storageUsed
        ));
    }

    /**
     * Get message activity for chart (last 7 days)
     */
    @GetMapping("/stats/activity")
    public ResponseEntity<?> getMessageActivity(Principal principal) {
        if (!isAdmin(principal)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        List<Map<String, Object>> activity = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate date = LocalDate.now().minusDays(i);
            LocalDateTime start = date.atStartOfDay();
            LocalDateTime end = date.plusDays(1).atStartOfDay();
            long count = messageRepository.countByTimestampBetween(start, end);
            
            activity.add(Map.of(
                    "date", date.toString(),
                    "count", count
            ));
        }

        return ResponseEntity.ok(activity);
    }

    /**
     * Get all users for management
     */
    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers(Principal principal) {
        if (!isAdmin(principal)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        List<User> users = userRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();

        for (User user : users) {
            Map<String, Object> userMap = new HashMap<>();
            userMap.put("id", user.getId());
            userMap.put("username", user.getUsername());
            userMap.put("email", user.getEmail());
            userMap.put("role", user.getRole());
            userMap.put("isOnline", user.isOnline());
            userMap.put("isBanned", user.isBanned());
            userMap.put("bannedBy", user.getBannedBy());
            userMap.put("createdAt", user.getCreatedAt());
            userMap.put("lastSeen", user.getLastSeen());
            userMap.put("messageCount", messageRepository.countBySender(user.getUsername()));
            result.add(userMap);
        }

        return ResponseEntity.ok(result);
    }

    /**
     * Ban a user
     */
    @PostMapping("/users/{id}/ban")
    @Transactional
    public ResponseEntity<?> banUser(@PathVariable Long id, Principal principal) {
        if (!isAdmin(principal)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        
        // Can't ban admins
        if (user.getRole() == Role.ADMIN) {
            return ResponseEntity.badRequest().body(Map.of("message", "Cannot ban an admin"));
        }

        user.setBanned(true);
        user.setBannedAt(LocalDateTime.now());
        user.setBannedBy(principal.getName());
        user.setOnline(false);
        userRepository.save(user);

        broadcastUserUpdate(user);

        return ResponseEntity.ok(Map.of("message", "User banned successfully"));
    }

    /**
     * Unban a user
     */
    @PostMapping("/users/{id}/unban")
    @Transactional
    public ResponseEntity<?> unbanUser(@PathVariable Long id, Principal principal) {
        if (!isAdmin(principal)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        user.setBanned(false);
        user.setBannedAt(null);
        user.setBannedBy(null);
        userRepository.save(user);

        broadcastUserUpdate(user);

        return ResponseEntity.ok(Map.of("message", "User unbanned successfully"));
    }

    /**
     * Promote user to moderator
     */
    @PostMapping("/users/{id}/promote")
    @Transactional
    public ResponseEntity<?> promoteUser(@PathVariable Long id, Principal principal) {
        if (!isAdmin(principal)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        
        if (user.getRole() == Role.ADMIN) {
            return ResponseEntity.badRequest().body(Map.of("message", "User is already an admin"));
        }

        user.setRole(Role.MODERATOR);
        userRepository.save(user);

        broadcastUserUpdate(user);

        return ResponseEntity.ok(Map.of("message", "User promoted to moderator"));
    }

    /**
     * Demote moderator to user
     */
    @PostMapping("/users/{id}/demote")
    @Transactional
    public ResponseEntity<?> demoteUser(@PathVariable Long id, Principal principal) {
        if (!isAdmin(principal)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        
        if (user.getRole() == Role.ADMIN) {
            return ResponseEntity.badRequest().body(Map.of("message", "Cannot demote an admin"));
        }

        user.setRole(Role.USER);
        userRepository.save(user);

        broadcastUserUpdate(user);

        return ResponseEntity.ok(Map.of("message", "User demoted to regular user"));
    }

    /**
     * Get user's message history (Spy Mode)
     */
    @GetMapping("/users/{id}/messages")
    public ResponseEntity<?> getUserMessages(@PathVariable Long id, Principal principal) {
        if (!isAdmin(principal)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        var messages = messageRepository.findBySenderOrderByTimestampDesc(user.getUsername());

        return ResponseEntity.ok(messages);
    }

    private boolean isAdmin(Principal principal) {
        if (principal == null) return false;
        Optional<User> userOpt = userRepository.findByUsername(principal.getName());
        return userOpt.isPresent() && userOpt.get().getRole() == Role.ADMIN;
    }
}
