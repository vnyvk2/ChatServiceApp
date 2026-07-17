package com.example.chatservice.Controller;

import com.example.chatservice.Model.Profile;
import com.example.chatservice.Model.User;
import com.example.chatservice.service.ProfileService;
import com.example.chatservice.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/profiles")
@CrossOrigin(origins = "*")
@Tag(name = "Profile Management", description = "Endpoints for managing user profiles (avatar and bio)")
public class ProfileController {

    private final ProfileService profileService;
    private final UserService userService;

    public ProfileController(ProfileService profileService, UserService userService) {
        this.profileService = profileService;
        this.userService = userService;
    }

    @GetMapping("/me")
    @Operation(summary = "Get own profile", description = "Fetches the authenticated user's profile details.")
    public ResponseEntity<?> getMyProfile(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        User user = userService.resolveUserByUsername(userDetails.getUsername());
        Profile profile = profileService.getProfileForViewer(user.getId(), true);
        return ResponseEntity.ok(profile);
    }

    @GetMapping("/{userId}")
    @Operation(summary = "Get a user's profile", description = "Fetches a specific user's profile details by userId. Respects profile picture visibility settings.")
    public ResponseEntity<?> getUserProfile(
            @PathVariable String userId,
            @AuthenticationPrincipal UserDetails userDetails) {

        boolean isOwner = false;
        if (userDetails != null) {
            User requester = userService.resolveUserByUsername(userDetails.getUsername());
            isOwner = requester.getId().equals(userId);
        }

        Profile profile = profileService.getProfileForViewer(userId, isOwner);
        return ResponseEntity.ok(profile);
    }

    @PutMapping("/{userId}")
    @Operation(summary = "Create or Update profile", description = "Updates profile fields partially based on the request body (e.g., avatarUrl, bio, profilePicVisibility).")
    public ResponseEntity<?> updateProfile(
            @PathVariable String userId,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> payload) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        User user = userService.resolveUserByUsername(userDetails.getUsername());
        if (!user.getId().equals(userId) && !user.getUsername().equals(userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Not authorized to update this profile"));
        }

        Profile updated = profileService.updateProfile(userId, payload);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{userId}/avatar")
    @Operation(summary = "Upload profile picture", description = "Uploads a new profile picture (JPEG, PNG, GIF, WebP, max 5MB).")
    public ResponseEntity<?> uploadAvatar(
            @PathVariable String userId,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam("file") MultipartFile file) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        User user = userService.resolveUserByUsername(userDetails.getUsername());
        if (!user.getId().equals(userId) && !user.getUsername().equals(userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Not authorized to upload avatar for this profile"));
        }

        try {
            Profile updated = profileService.uploadAvatar(userId, file);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to upload avatar: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{userId}/avatar")
    @Operation(summary = "Remove profile picture", description = "Deletes only the avatarUrl for the specified user.")
    public ResponseEntity<?> removeAvatar(
            @PathVariable String userId,
            @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        User user = userService.resolveUserByUsername(userDetails.getUsername());
        if (!user.getId().equals(userId) && !user.getUsername().equals(userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Not authorized to modify this profile"));
        }

        profileService.removeAvatar(userId);
        return ResponseEntity.ok(Map.of("message", "Profile picture removed successfully"));
    }

    @DeleteMapping("/{userId}")
    @Operation(summary = "Remove profile", description = "Deletes the entire profile document (avatarUrl and bio) for the specified user.")
    public ResponseEntity<?> removeProfile(
            @PathVariable String userId,
            @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        User user = userService.resolveUserByUsername(userDetails.getUsername());
        if (!user.getId().equals(userId) && !user.getUsername().equals(userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Not authorized to delete this profile"));
        }

        profileService.removeProfile(userId);
        return ResponseEntity.ok(Map.of("message", "Profile removed successfully"));
    }
}
