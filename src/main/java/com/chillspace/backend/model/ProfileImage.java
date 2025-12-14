package com.chillspace.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * Separate entity for storing profile images to keep users table clean
 */
@Entity
@Table(name = "profile_images")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProfileImage {

    @Id
    private Long userId; // Same as User ID (one-to-one relationship)

    @Lob
    @Column(name = "image_data", columnDefinition = "LONGTEXT")
    private String imageData; // Base64 encoded image

    @Column(name = "image_type")
    private String imageType; // e.g., "image/png", "image/jpeg"

    @OneToOne
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;
}
