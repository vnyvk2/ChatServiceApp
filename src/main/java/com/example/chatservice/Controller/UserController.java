package com.example.chatservice.Controller;

import com.example.chatservice.Model.User;
import com.example.chatservice.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
@Tag(name = "User Management", description = "Endpoints for managing user profiles and searching users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
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
        User user = userService.resolveUserByUsername(userDetails.getUsername());
        User updated = userService.updateUserProfile(
                user.getId(),
                updates.get("username"),
                updates.get("phoneNumber"),
                updates.get("email"));
        return ResponseEntity.ok(updated);
    }

    // ---- Privacy Settings ----

    @GetMapping("/read-receipts")
    @Operation(summary = "Get read receipt setting", description = "Returns whether the authenticated user has read receipts enabled.")
    public ResponseEntity<?> getReadReceiptSetting(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        User user = userService.resolveUserByUsername(userDetails.getUsername());
        boolean enabled = userService.getReadReceiptsEnabled(user.getId());
        return ResponseEntity.ok(Map.of("readReceiptsEnabled", enabled));
    }

    @PutMapping("/read-receipts")
    @Operation(summary = "Toggle read receipts", description = "Enables or disables read receipts (blue ticks) for the authenticated user.")
    public ResponseEntity<?> toggleReadReceipts(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Boolean> body) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        Boolean enabled = body.get("readReceiptsEnabled");
        if (enabled == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "readReceiptsEnabled is required"));
        }
        User user = userService.resolveUserByUsername(userDetails.getUsername());
        boolean result = userService.toggleReadReceipts(user.getId(), enabled);
        return ResponseEntity.ok(Map.of("readReceiptsEnabled", result));
    }

    @GetMapping("/online-status")
    @Operation(summary = "Get online status setting", description = "Returns whether the authenticated user has online status visibility enabled.")
    public ResponseEntity<?> getOnlineStatusSetting(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        User user = userService.resolveUserByUsername(userDetails.getUsername());
        boolean enabled = userService.getShowOnlineStatus(user.getId());
        return ResponseEntity.ok(Map.of("showOnlineStatus", enabled));
    }

    @PutMapping("/online-status")
    @Operation(summary = "Toggle online status visibility", description = "Enables or disables online status (green dot) visibility for the authenticated user.")
    public ResponseEntity<?> toggleOnlineStatus(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Boolean> body) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        Boolean enabled = body.get("showOnlineStatus");
        if (enabled == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "showOnlineStatus is required"));
        }
        User user = userService.resolveUserByUsername(userDetails.getUsername());
        boolean result = userService.toggleOnlineStatus(user.getId(), enabled);
        return ResponseEntity.ok(Map.of("showOnlineStatus", result));
    }

    @GetMapping("/last-seen-visibility")
    @Operation(summary = "Get last seen setting", description = "Returns whether the authenticated user has last seen visibility enabled.")
    public ResponseEntity<?> getLastSeenVisibility(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        User user = userService.resolveUserByUsername(userDetails.getUsername());
        boolean enabled = userService.getLastSeenVisible(user.getId());
        return ResponseEntity.ok(Map.of("lastSeenVisible", enabled));
    }

    @PutMapping("/last-seen-visibility")
    @Operation(summary = "Toggle last seen visibility", description = "Enables or disables last seen timestamp visibility. If disabled, user also cannot see others' last seen.")
    public ResponseEntity<?> toggleLastSeenVisibility(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Boolean> body) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        Boolean enabled = body.get("lastSeenVisible");
        if (enabled == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "lastSeenVisible is required"));
        }
        User user = userService.resolveUserByUsername(userDetails.getUsername());
        boolean result = userService.toggleLastSeenVisibility(user.getId(), enabled);
        return ResponseEntity.ok(Map.of("lastSeenVisible", result));
    }

    // ---- Per-field Privacy Visibility ----

    @GetMapping("/privacy")
    @Operation(summary = "Get privacy settings", description = "Returns the authenticated user's per-field privacy visibility settings (username, displayName, phone, email).")
    public ResponseEntity<?> getPrivacySettings(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        User user = userService.resolveUserByUsername(userDetails.getUsername());
        Map<String, String> settings = userService.getPrivacySettings(user.getId());
        return ResponseEntity.ok(settings);
    }

    @PutMapping("/privacy")
    @Operation(summary = "Update privacy settings", description = "Updates per-field visibility settings. Each field can be set to PUBLIC, CONNECTIONS, or NOBODY.")
    public ResponseEntity<?> updatePrivacySettings(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        User user = userService.resolveUserByUsername(userDetails.getUsername());
        Map<String, String> result = userService.updatePrivacySettings(user.getId(), body);
        return ResponseEntity.ok(result);
    }

    // ---- CRUD Endpoints ----

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
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete user by ID or username", description = "Deletes a user by their MongoDB ObjectId or username.")
    public ResponseEntity<?> deleteUser(@PathVariable String id) {
        userService.deleteByIdOrUsername(id);
        return ResponseEntity.ok(Map.of("message", "User deleted successfully"));
    }
}
