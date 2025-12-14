package com.chillspace.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ChillSpaceApplication {

    public static void main(String[] args) {
        SpringApplication.run(ChillSpaceApplication.class, args);
    }
    
    @org.springframework.context.annotation.Bean
    public org.springframework.boot.CommandLineRunner resetOnlineStatus(com.chillspace.backend.repository.UserRepository userRepository) {
        return args -> {
            java.util.List<com.chillspace.backend.model.User> onlineUsers = userRepository.findAll().stream()
                .filter(com.chillspace.backend.model.User::isOnline)
                .collect(java.util.stream.Collectors.toList());
            
            for (com.chillspace.backend.model.User user : onlineUsers) {
                user.setOnline(false);
                userRepository.save(user);
            }
            if (!onlineUsers.isEmpty()) {
                System.out.println("🔄 Reset " + onlineUsers.size() + " users to offline status.");
            }
        };
    }
}
