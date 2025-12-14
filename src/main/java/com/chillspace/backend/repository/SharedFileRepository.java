package com.chillspace.backend.repository;

import com.chillspace.backend.model.SharedFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface SharedFileRepository extends JpaRepository<SharedFile, Long> {
    
    List<SharedFile> findAllByOrderByUploadedAtDesc();
    
    List<SharedFile> findByUploadedByOrderByUploadedAtDesc(String username);
    
    @Query("SELECT sf FROM SharedFile sf WHERE sf.fileData IS NULL ORDER BY sf.uploadedAt DESC")
    List<SharedFile> findAllMetadataOnly();

    // Admin stats
    @Query("SELECT SUM(sf.fileSize) FROM SharedFile sf")
    Long sumFileSizes();
}

