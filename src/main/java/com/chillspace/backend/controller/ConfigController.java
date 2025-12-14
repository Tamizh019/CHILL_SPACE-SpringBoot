package com.chillspace.backend.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/config")
public class ConfigController {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.key}")
    private String supabaseKey;

    @GetMapping("/supabase")
    public ResponseEntity<?> getSupabaseConfig() {
        return ResponseEntity.ok(Map.of(
            "url", supabaseUrl,
            "key", supabaseKey
        ));
    }
}
