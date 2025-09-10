package com.example.chatservice.service;


import com.example.chatservice.domain.User;
import com.example.chatservice.repository.UserRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public UserService(UserRepository userRepository, SimpMessagingTemplate messagingTemplate) {
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Transactional
    public void updateUserStatus(Long userId, User.UserStatus status) {
        User user = userRepository.findById(userId).orElseThrow();
        User.UserStatus oldStatus = user.getStatus();
        user.setStatus(status);
        user.setLastSeenAt(Instant.now());
        userRepository.save(user);

        // Broadcast status change
        if (!oldStatus.equals(status)) {
            Map<String, Object> statusEvent = Map.of(
                    "type", "STATUS_CHANGED",
                    "user", Map.of(
                            "username", user.getUsername(),
                            "displayName", user.getDisplayName(),
                            "status", status.toString()
                    ),
                    "timestamp", System.currentTimeMillis()
            );
            messagingTemplate.convertAndSend("/topic/user-status/" + user.getUsername(), statusEvent);
        }
    }
}