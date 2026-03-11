package com.example.chatservice.Controller;

import com.example.chatservice.Model.User;
import com.example.chatservice.repository.UserRepository;
import com.example.chatservice.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
@Tag(name = "User Management", description = "Endpoints for managing user profiles and searching users")
public class UserController {

    private final UserService userService;
    private final UserRepository userRepository;

    public UserController(UserService userService, UserRepository userRepository) {
        this.userService = userService;
        this.userRepository = userRepository;
    }


    @GetMapping("/search")
    @Operation(summary = "Search users", description = "Searches for a user by username, email, or phone number with pagination.")
    public ResponseEntity<?> searchUsers(
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String phone,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        Pageable pageable = PageRequest.of(page, size);

        if (username != null) {
            Page<User> result = userService.searchByUsername(username, pageable);
            return ResponseEntity.ok(result);
        }
        if (email != null) {
            Page<User> result = userService.searchByEmail(email, pageable);
            return ResponseEntity.ok(result);
        }
        if (phone != null) {
            Page<User> result = userService.searchByPhoneNumber(phone, pageable);
            return ResponseEntity.ok(result);
        }
        return ResponseEntity.badRequest().body(Map.of("error", "Provide username, email, or phone"));
    }

    @PutMapping("/profile")
    @Operation(summary = "Update own profile", description = "Updates the authenticated user's profile including username, phone number, and email.")
    public ResponseEntity<?> updateProfile(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> updates) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        try {
            User user = userRepository.findByUsername(userDetails.getUsername())
                    .orElseThrow(() -> new RuntimeException("User not found"));
            User updated = userService.updateUserProfile(
                    user.getId(),
                    updates.get("username"),
                    updates.get("phoneNumber"),
                    updates.get("email"));
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/read-receipts")
    @Operation(summary = "Get read receipt setting", description = "Returns whether the authenticated user has read receipts enabled.")
    public ResponseEntity<?> getReadReceiptSetting(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(Map.of("readReceiptsEnabled", user.isReadReceiptsEnabled()));
    }

    @PutMapping("/read-receipts")
    @Operation(summary = "Toggle read receipts", description = "Enables or disables read receipts (blue ticks) for the authenticated user.")
    public ResponseEntity<?> toggleReadReceipts(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Boolean> body) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        try {
            User user = userRepository.findByUsername(userDetails.getUsername())
                    .orElseThrow(() -> new RuntimeException("User not found"));
            Boolean enabled = body.get("readReceiptsEnabled");
            if (enabled == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "readReceiptsEnabled is required"));
            }
            user.setReadReceiptsEnabled(enabled);
            userRepository.save(user);
            return ResponseEntity.ok(Map.of("readReceiptsEnabled", user.isReadReceiptsEnabled()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/online-status")
    @Operation(summary = "Get online status setting", description = "Returns whether the authenticated user has online status visibility enabled.")
    public ResponseEntity<?> getOnlineStatusSetting(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(Map.of("showOnlineStatus", user.isShowOnlineStatus()));
    }

    @PutMapping("/online-status")
    @Operation(summary = "Toggle online status visibility", description = "Enables or disables online status (green dot) visibility for the authenticated user.")
    public ResponseEntity<?> toggleOnlineStatus(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Boolean> body) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        try {
            User user = userRepository.findByUsername(userDetails.getUsername())
                    .orElseThrow(() -> new RuntimeException("User not found"));
            Boolean enabled = body.get("showOnlineStatus");
            if (enabled == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "showOnlineStatus is required"));
            }
            user.setShowOnlineStatus(enabled);
            userRepository.save(user);
            return ResponseEntity.ok(Map.of("showOnlineStatus", user.isShowOnlineStatus()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/last-seen-visibility")
    @Operation(summary = "Get last seen setting", description = "Returns whether the authenticated user has last seen visibility enabled.")
    public ResponseEntity<?> getLastSeenVisibility(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(Map.of("lastSeenVisible", user.isLastSeenVisible()));
    }

    @PutMapping("/last-seen-visibility")
    @Operation(summary = "Toggle last seen visibility", description = "Enables or disables last seen timestamp visibility. If disabled, user also cannot see others' last seen.")
    public ResponseEntity<?> toggleLastSeenVisibility(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Boolean> body) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        try {
            User user = userRepository.findByUsername(userDetails.getUsername())
                    .orElseThrow(() -> new RuntimeException("User not found"));
            Boolean enabled = body.get("lastSeenVisible");
            if (enabled == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "lastSeenVisible is required"));
            }
            user.setLastSeenVisible(enabled);
            userRepository.save(user);
            return ResponseEntity.ok(Map.of("lastSeenVisible", user.isLastSeenVisible()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ---- New Endpoints ----

    @GetMapping
    @Operation(summary = "Get all users", description = "Fetches a list of all registered users.")
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get user by ID or username", description = "Fetches a single user by their MongoDB ID or username.")
    public ResponseEntity<?> getUserByIdentifier(@PathVariable String id) {
        Optional<User> user = userService.findByIdOrUsername(id);
        if (user.isPresent()) {
            return ResponseEntity.ok(user.get());
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}")
    @Operation(summary = "Edit user by ID or username", description = "Updates user information. The identifier can be a MongoDB ObjectId or username.")
    public ResponseEntity<?> updateUser(
            @PathVariable String id,
            @RequestBody Map<String, String> updates) {
        try {
            Optional<User> userOpt = userService.findByIdOrUsername(id);
            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            User updated = userService.updateUserProfile(
                    userOpt.get().getId(),
                    updates.get("username"),
                    updates.get("phoneNumber"),
                    updates.get("email"));
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete user by ID or username", description = "Deletes a user by their MongoDB ObjectId or username.")
    public ResponseEntity<?> deleteUser(@PathVariable String id) {
        try {
            userService.deleteByIdOrUsername(id);
            return ResponseEntity.ok(Map.of("message", "User deleted successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
