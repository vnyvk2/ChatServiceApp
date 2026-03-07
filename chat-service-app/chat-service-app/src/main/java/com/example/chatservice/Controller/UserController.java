package com.example.chatservice.Controller;

import com.example.chatservice.domain.User;
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
