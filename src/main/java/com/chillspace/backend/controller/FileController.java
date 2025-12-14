package com.chillspace.backend.controller;

import com.chillspace.backend.model.SharedFile;
import com.chillspace.backend.repository.SharedFileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.*;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final SharedFileRepository fileRepository;

    // Maximum file size: 50MB
    private static final long MAX_FILE_SIZE = 50 * 1024 * 1024;

    /**
     * Upload a new file
     */
    @PostMapping("/upload")
    @Transactional
    public ResponseEntity<?> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "description", required = false) String description,
            Principal principal) {

        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "No file uploaded"));
            }

            if (file.getSize() > MAX_FILE_SIZE) {
                return ResponseEntity.badRequest().body(Map.of("message", "File size must be less than 50MB"));
            }

            SharedFile sharedFile = new SharedFile();
            sharedFile.setFilename(UUID.randomUUID().toString());
            sharedFile.setOriginalFilename(file.getOriginalFilename());
            sharedFile.setContentType(file.getContentType());
            sharedFile.setFileSize(file.getSize());
            sharedFile.setFileData(file.getBytes());
            sharedFile.setUploadedBy(principal.getName());
            sharedFile.setDescription(description);

            fileRepository.save(sharedFile);

            return ResponseEntity.ok(Map.of(
                    "message", "File uploaded successfully",
                    "fileId", sharedFile.getId(),
                    "filename", sharedFile.getOriginalFilename()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to upload file: " + e.getMessage()));
        }
    }

    /**
     * List all shared files (metadata only, no file data)
     */
    @GetMapping
    public ResponseEntity<?> listFiles() {
        List<SharedFile> files = fileRepository.findAllByOrderByUploadedAtDesc();
        List<Map<String, Object>> result = new ArrayList<>();

        for (SharedFile file : files) {
            Map<String, Object> fileInfo = new HashMap<>();
            fileInfo.put("id", file.getId());
            fileInfo.put("filename", file.getOriginalFilename());
            fileInfo.put("contentType", file.getContentType());
            fileInfo.put("fileSize", file.getFileSize());
            fileInfo.put("uploadedBy", file.getUploadedBy());
            fileInfo.put("uploadedAt", file.getUploadedAt());
            fileInfo.put("description", file.getDescription());
            result.add(fileInfo);
        }

        return ResponseEntity.ok(result);
    }

    /**
     * Download a file by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> downloadFile(@PathVariable Long id) {
        Optional<SharedFile> fileOpt = fileRepository.findById(id);

        if (fileOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        SharedFile file = fileOpt.get();

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        file.getContentType() != null ? file.getContentType() : "application/octet-stream"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + file.getOriginalFilename() + "\"")
                .body(file.getFileData());
    }

    /**
     * Get file info (metadata only)
     */
    @GetMapping("/{id}/info")
    public ResponseEntity<?> getFileInfo(@PathVariable Long id) {
        Optional<SharedFile> fileOpt = fileRepository.findById(id);

        if (fileOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        SharedFile file = fileOpt.get();

        return ResponseEntity.ok(Map.of(
                "id", file.getId(),
                "filename", file.getOriginalFilename(),
                "contentType", file.getContentType() != null ? file.getContentType() : "unknown",
                "fileSize", file.getFileSize(),
                "uploadedBy", file.getUploadedBy(),
                "uploadedAt", file.getUploadedAt(),
                "description", file.getDescription() != null ? file.getDescription() : ""
        ));
    }

    /**
     * Delete a file (only uploader or admin can delete)
     */
    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteFile(@PathVariable Long id, Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Optional<SharedFile> fileOpt = fileRepository.findById(id);

        if (fileOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        SharedFile file = fileOpt.get();

        // Only allow uploader to delete (admins handled by role check in security)
        if (!file.getUploadedBy().equals(principal.getName())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "You can only delete your own files"));
        }

        fileRepository.delete(file);

        return ResponseEntity.ok(Map.of("message", "File deleted successfully"));
    }
}
