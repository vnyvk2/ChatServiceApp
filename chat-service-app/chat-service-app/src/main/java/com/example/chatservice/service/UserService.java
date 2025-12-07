package com.example.chatservice.service;

import com.example.chatservice.domain.User;
import com.example.chatservice.repository.UserRepository;
import org.springframework.lang.NonNull;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository,
            @Autowired(required = false) SimpMessagingTemplate messagingTemplate,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
        this.passwordEncoder = passwordEncoder;
    }

    // ---- New: register and authenticate ----
    @Transactional
    public User registerUser(String username, String rawPassword, String displayName, String email,
            String phoneNumber) {
        if (userRepository.existsByUsername(username)) {
            throw new RuntimeException("Username already exists");
        }
        if (email != null && userRepository.existsByEmail(email)) {
            throw new RuntimeException("Email already in use");
        }
        if (phoneNumber != null && !phoneNumber.isBlank() && userRepository.existsByPhoneNumber(phoneNumber)) {
            throw new RuntimeException("Phone number already in use");
        }

        User user = new User();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setDisplayName(displayName != null ? displayName : username);
        user.setEmail(email);
        user.setPhoneNumber(phoneNumber);
        user.setStatus(User.UserStatus.OFFLINE);
        return userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public User authenticate(String username, String rawPassword) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Invalid username or password"));

        if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            throw new RuntimeException("Invalid username or password");
        }

        return user;
    }

    // ---- Existing methods you had (kept/merged) ----
    @Transactional
    public void updateUserStatus(@NonNull Long userId, User.UserStatus status) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            User.UserStatus oldStatus = user.getStatus();
            user.setStatus(status);
            user.setLastSeenAt(Instant.now());
            userRepository.save(user);

            if (!oldStatus.equals(status) && messagingTemplate != null) {
                Map<String, Object> statusEvent = Map.of(
                        "type", "STATUS_CHANGED",
                        "user", Map.of(
                                "username", user.getUsername(),
                                "displayName", user.getDisplayName(),
                                "status", status.toString()),
                        "timestamp", System.currentTimeMillis());
                messagingTemplate.convertAndSend("/topic/user-status/" + user.getUsername(), statusEvent);
            }
        }
    }

    @Transactional(readOnly = true)
    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    @Transactional(readOnly = true)
    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    @Transactional(readOnly = true)
    public Optional<User> findByPhoneNumber(String phoneNumber) {
        return userRepository.findByPhoneNumber(phoneNumber);
    }

    @Transactional(readOnly = true)
    public Optional<User> findById(@NonNull Long id) {
        return userRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public List<User> getOnlineUsers() {
        return userRepository.findOnlineUsers();
    }

    @Transactional
    public User saveUser(@NonNull User user) {
        return userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public boolean existsByUsername(String username) {
        return userRepository.existsByUsername(username);
    }

    @Transactional(readOnly = true)
    public boolean existsByEmail(String email) {
        return userRepository.existsByEmail(email);
    }

    @Transactional(readOnly = true)
    public boolean existsByPhoneNumber(String phoneNumber) {
        return userRepository.existsByPhoneNumber(phoneNumber);
    }

    @Transactional
    public void updateLastSeen(@NonNull Long userId) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setLastSeenAt(Instant.now());
            userRepository.save(user);
        }
    }
}
