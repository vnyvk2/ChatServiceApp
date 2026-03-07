package com.example.chatservice.service;

import com.example.chatservice.domain.User;
import com.example.chatservice.exception.DuplicateResourceException;
import com.example.chatservice.exception.ResourceNotFoundException;
import com.example.chatservice.repository.UserRepository;
import org.springframework.lang.NonNull;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
    public User registerUser(String username, String rawPassword, String displayName, String email,
            String phoneNumber) {
        if (userRepository.existsByUsername(username)) {
            throw new DuplicateResourceException("Username already exists");
        }
        if (email != null && userRepository.existsByEmail(email)) {
            throw new DuplicateResourceException("Email already in use");
        }
        if (phoneNumber != null && !phoneNumber.isBlank() && userRepository.existsByPhoneNumber(phoneNumber)) {
            throw new DuplicateResourceException("Phone number already in use");
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

    public User authenticate(String username, String rawPassword) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid username or password"));

        if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            throw new RuntimeException("Invalid username or password");
        }

        return user;
    }

    // ---- Paginated Search Methods ----
    public Page<User> searchByUsername(String username, Pageable pageable) {
        return userRepository.findByUsernameContainingIgnoreCase(username, pageable);
    }

    public Page<User> searchByEmail(String email, Pageable pageable) {
        return userRepository.findByEmailContainingIgnoreCase(email, pageable);
    }

    public Page<User> searchByPhoneNumber(String phoneNumber, Pageable pageable) {
        return userRepository.findByPhoneNumberContainingIgnoreCase(phoneNumber, pageable);
    }

    // ---- Existing methods ----
    public void updateUserStatus(@NonNull String userId, User.UserStatus status) {
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

    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public Optional<User> findByPhoneNumber(String phoneNumber) {
        return userRepository.findByPhoneNumber(phoneNumber);
    }

    public Optional<User> findById(@NonNull String id) {
        return userRepository.findById(id);
    }

    public List<User> getOnlineUsers() {
        return userRepository.findByStatus(User.UserStatus.ONLINE);
    }

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public User saveUser(@NonNull User user) {
        return userRepository.save(user);
    }

    public boolean existsByUsername(String username) {
        return userRepository.existsByUsername(username);
    }

    public boolean existsByEmail(String email) {
        return userRepository.existsByEmail(email);
    }

    public boolean existsByPhoneNumber(String phoneNumber) {
        return userRepository.existsByPhoneNumber(phoneNumber);
    }

    public void updateLastSeen(@NonNull String userId) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setLastSeenAt(Instant.now());
            userRepository.save(user);
        }
    }

    public User updateUserProfile(String userId, String username, String phoneNumber, String email) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (username != null && !username.isBlank() && !user.getUsername().equals(username)) {
            if (userRepository.existsByUsername(username)) {
                throw new DuplicateResourceException("Username already taken");
            }
            user.setUsername(username);
            user.setDisplayName(username);
        }

        if (phoneNumber != null && !phoneNumber.isBlank() && !phoneNumber.equals(user.getPhoneNumber())) {
            if (userRepository.existsByPhoneNumber(phoneNumber)) {
                throw new DuplicateResourceException("Phone number already taken");
            }
            user.setPhoneNumber(phoneNumber);
        }

        if (email != null && !email.isBlank() && !email.equals(user.getEmail())) {
            if (userRepository.existsByEmail(email)) {
                throw new DuplicateResourceException("Email already taken");
            }
            user.setEmail(email);
        }

        return userRepository.save(user);
    }

    /**
     * Find a user by ID or username. Tries ID first, then username.
     */
    public Optional<User> findByIdOrUsername(String identifier) {
        Optional<User> user = userRepository.findById(identifier);
        if (user.isPresent()) {
            return user;
        }
        return userRepository.findByUsername(identifier);
    }

    /**
     * Delete a user by ID or username.
     */
    public void deleteByIdOrUsername(String identifier) {
        Optional<User> user = findByIdOrUsername(identifier);
        if (user.isPresent()) {
            userRepository.delete(user.get());
        } else {
            throw new ResourceNotFoundException("User not found with identifier: " + identifier);
        }
    }
}
