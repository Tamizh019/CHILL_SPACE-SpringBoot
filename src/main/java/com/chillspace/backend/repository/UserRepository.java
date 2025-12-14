package com.chillspace.backend.repository;

import com.chillspace.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    Boolean existsByUsername(String username);

    Boolean existsByEmail(String email);

    // Admin stats
    long countByIsOnline(boolean isOnline);

    long countByIsBanned(boolean isBanned);

    long countByCreatedAtAfter(LocalDateTime date);
}

