package com.chillspace.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role = Role.USER;

    private String avatarUrl;

    @Column(name = "avatar_style")
    private String avatarStyle = "initials";

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    // Online status tracking
    private boolean isOnline = false;
    private LocalDateTime lastSeen;

    // Admin controls
    @Column(name = "is_banned")
    private Boolean isBanned = false; // Use Wrapper to safely handle potential NULLs from DB

    @Column(name = "banned_at")
    private LocalDateTime bannedAt;

    @Column(name = "banned_by")
    private String bannedBy;
    
    // Explicit getter to handle nulls safely
    public boolean isBanned() {
        return Boolean.TRUE.equals(isBanned);
    }
    
    public void setBanned(boolean banned) {
        this.isBanned = banned;
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}

