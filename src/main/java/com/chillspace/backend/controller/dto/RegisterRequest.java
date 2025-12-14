package com.chillspace.backend.controller.dto;

import lombok.Data;

@Data
public class RegisterRequest {
    private String username;
    private String email;
    private String password;
    private String supabaseAccessToken;
}
