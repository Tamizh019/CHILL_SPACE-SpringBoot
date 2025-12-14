package com.chillspace.backend.controller;

import com.chillspace.backend.model.Message;
import com.chillspace.backend.model.MessageType;
import com.chillspace.backend.model.Role;
import com.chillspace.backend.model.User;
import com.chillspace.backend.repository.MessageRepository;
import com.chillspace.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequiredArgsConstructor
public class ChatController {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;

    // Thread-safe Set to store online users
    private final Set<String> onlineUsers = ConcurrentHashMap.newKeySet();

    @MessageMapping("/chat.sendMessage")
    @SendTo("/topic/public")
    public Message sendMessage(@Payload Message chatMessage) {
        if (chatMessage.getType() == MessageType.CHAT) {
            // Fetch User to get authoritative Role
            Optional<User> sender = userRepository.findByUsername(chatMessage.getSender());
            if (sender.isPresent()) {
                chatMessage.setSenderRole(sender.get().getRole());
                messageRepository.save(chatMessage);
            }
        }
        return chatMessage;
    }

    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    public Message addUser(@Payload Message chatMessage, SimpMessageHeaderAccessor headerAccessor) {
        // Add username in web socket session
        headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());

        // Add to online list (In-Memory)
        onlineUsers.add(chatMessage.getSender());
        
        // Sync with Database
        userRepository.findByUsername(chatMessage.getSender()).ifPresent(user -> {
            user.setOnline(true);
            user.setLastSeen(java.time.LocalDateTime.now());
            userRepository.save(user);
        });

        return chatMessage;
    }

    // Helper to remove user (called by EventListener)
    public void removeUser(String username) {
        onlineUsers.remove(username);
        
        // Sync with Database
        userRepository.findByUsername(username).ifPresent(user -> {
            user.setOnline(false);
            user.setLastSeen(java.time.LocalDateTime.now());
            userRepository.save(user);
        });
    }

    // API to get online users
    @GetMapping("/api/chat/online")
    @ResponseBody
    public Set<String> getOnlineUsers() {
        return onlineUsers;
    }

    // REST Endpoint to fetch history
    @GetMapping("/api/chat/history")
    @ResponseBody
    public List<Message> getChatHistory() {
        return messageRepository.findAllByOrderByTimestampAsc();
    }

    // DELETE Message Endpoint
    @DeleteMapping("/api/chat/{id}")
    public ResponseEntity<?> deleteMessage(@PathVariable Long id, Principal principal) {
        if (principal == null)
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        String username = principal.getName();
        User requester = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Message message = messageRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        boolean canDelete = false;

        if (requester.getRole() == Role.ADMIN) {
            canDelete = true;
        } else if (requester.getRole() == Role.MODERATOR) {
            // Mod can delete anyone EXCEPT Admin
            // If sender role is null (legacy), assume User
            Role senderRole = message.getSenderRole() != null ? message.getSenderRole() : Role.USER;
            if (senderRole != Role.ADMIN) {
                canDelete = true;
            }
        } else {
            // User can only delete OWN messages
            if (message.getSender().equals(username)) {
                canDelete = true;
            }
        }

        if (canDelete) {
            messageRepository.delete(message);
            // In a real STOMP app, we might want to broadcast the deletion ID to
            // /topic/public
            // so clients verify it in real-time. For now, clients will see it gone on
            // refresh.
            // We can also hack a "DELETE" message via WebSocket here if we injected
            // SimpMessagingTemplate.
            return ResponseEntity.ok().build();
        } else {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("You do not have permission to delete this message.");
        }
    }
}
