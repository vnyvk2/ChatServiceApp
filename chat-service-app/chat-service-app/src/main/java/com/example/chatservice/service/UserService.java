package com.example.chatservice.service;

import com.example.chatservice.Model.User;
import com.example.chatservice.exception.DuplicateResourceException;
import com.example.chatservice.exception.ResourceNotFoundException;
import com.example.chatservice.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.lang.NonNull;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

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
        String normalizedUsername = username != null ? username.trim() : null;
        String normalizedEmail = email != null && !email.isBlank() ? email.trim().toLowerCase() : null;
        String normalizedPhone = phoneNumber != null && !phoneNumber.isBlank() ? phoneNumber.trim() : null;

        if (normalizedUsername != null && userRepository.existsByUsername(normalizedUsername)) {
            throw new DuplicateResourceException("Username already exists");
        }
        if (normalizedEmail != null && userRepository.existsByEmail(normalizedEmail)) {
            throw new DuplicateResourceException("Email already in use");
        }
        if (normalizedPhone != null && userRepository.existsByPhoneNumber(normalizedPhone)) {
            throw new DuplicateResourceException("Phone number already in use");
        }

        User user = new User();
        user.setUsername(normalizedUsername);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setDisplayName(displayName != null && !displayName.isBlank() ? displayName.trim() : normalizedUsername);
        user.setEmail(normalizedEmail);
        user.setPhoneNumber(normalizedPhone);
        user.setStatus(User.UserStatus.OFFLINE);
        return userRepository.save(user);
    }

    public User authenticate(String username, String rawPassword) {
        String normalizedUsername = username != null ? username.trim() : "";
        User user = userRepository.findByUsername(normalizedUsername)
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

        if (username != null && !username.isBlank()) {
            String normalizedUsername = username.trim();
            if (!user.getUsername().equals(normalizedUsername)) {
                if (userRepository.existsByUsername(normalizedUsername)) {
                    throw new DuplicateResourceException("Username already taken");
                }
                user.setUsername(normalizedUsername);
                user.setDisplayName(normalizedUsername);
            }
        }

        if (phoneNumber != null && !phoneNumber.isBlank()) {
            String normalizedPhone = phoneNumber.trim();
            if (!normalizedPhone.equals(user.getPhoneNumber())) {
                if (userRepository.existsByPhoneNumber(normalizedPhone)) {
                    throw new DuplicateResourceException("Phone number already taken");
                }
                user.setPhoneNumber(normalizedPhone);
            }
        }

        if (email != null && !email.isBlank()) {
            String normalizedEmail = email.trim().toLowerCase();
            if (!normalizedEmail.equals(user.getEmail())) {
                if (userRepository.existsByEmail(normalizedEmail)) {
                    throw new DuplicateResourceException("Email already taken");
                }
                user.setEmail(normalizedEmail);
            }
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

    // ---- Privacy Settings ----

    /**
     * Resolves a User entity from a username. Throws ResourceNotFoundException if not found.
     */
    public User resolveUserByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    public boolean getReadReceiptsEnabled(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return user.isReadReceiptsEnabled();
    }

    public boolean toggleReadReceipts(String userId, boolean enabled) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        user.setReadReceiptsEnabled(enabled);
        userRepository.save(user);
        return user.isReadReceiptsEnabled();
    }

    public boolean getShowOnlineStatus(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return user.isShowOnlineStatus();
    }

    public boolean toggleOnlineStatus(String userId, boolean enabled) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        user.setShowOnlineStatus(enabled);
        userRepository.save(user);
        return user.isShowOnlineStatus();
    }

    public boolean getLastSeenVisible(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return user.isLastSeenVisible();
    }

    public boolean toggleLastSeenVisibility(String userId, boolean enabled) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        user.setLastSeenVisible(enabled);
        userRepository.save(user);
        return user.isLastSeenVisible();
    }

    public void invalidateUserTokens(String username) {
        if (username == null || username.isBlank()) {
            return;
        }
        userRepository.findByUsername(username.trim()).ifPresent(user -> {
            user.setTokenInvalidBefore(Instant.now());
            userRepository.save(user);
        });
    }

    // ---- Per-field Privacy Visibility Settings ----

    private static final Set<String> VALID_VISIBILITY = Set.of("PUBLIC", "CONNECTIONS", "NOBODY");

    public Map<String, String> getPrivacySettings(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return Map.of(
                "usernameVisibility", user.getUsernameVisibility() != null ? user.getUsernameVisibility() : "PUBLIC",
                "displayNameVisibility", user.getDisplayNameVisibility() != null ? user.getDisplayNameVisibility() : "PUBLIC",
                "phoneVisibility", user.getPhoneVisibility() != null ? user.getPhoneVisibility() : "CONNECTIONS",
                "emailVisibility", user.getEmailVisibility() != null ? user.getEmailVisibility() : "CONNECTIONS"
        );
    }

    public Map<String, String> updatePrivacySettings(String userId, Map<String, String> settings) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (settings.containsKey("usernameVisibility") && VALID_VISIBILITY.contains(settings.get("usernameVisibility"))) {
            user.setUsernameVisibility(settings.get("usernameVisibility"));
        }
        if (settings.containsKey("displayNameVisibility") && VALID_VISIBILITY.contains(settings.get("displayNameVisibility"))) {
            user.setDisplayNameVisibility(settings.get("displayNameVisibility"));
        }
        if (settings.containsKey("phoneVisibility") && VALID_VISIBILITY.contains(settings.get("phoneVisibility"))) {
            user.setPhoneVisibility(settings.get("phoneVisibility"));
        }
        if (settings.containsKey("emailVisibility") && VALID_VISIBILITY.contains(settings.get("emailVisibility"))) {
            user.setEmailVisibility(settings.get("emailVisibility"));
        }

        userRepository.save(user);

        return Map.of(
                "usernameVisibility", user.getUsernameVisibility(),
                "displayNameVisibility", user.getDisplayNameVisibility(),
                "phoneVisibility", user.getPhoneVisibility(),
                "emailVisibility", user.getEmailVisibility()
        );
    }
}
