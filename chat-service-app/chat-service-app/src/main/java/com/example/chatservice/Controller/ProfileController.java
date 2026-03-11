package com.example.chatservice.Controller;

import com.example.chatservice.Model.Profile;
import com.example.chatservice.Model.User;
import com.example.chatservice.repository.UserRepository;
import com.example.chatservice.service.ProfileService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/profiles")
@CrossOrigin(origins = "*")
@Tag(name = "Profile Management", description = "Endpoints for managing user profiles (avatar and bio)")
public class ProfileController {

    private final ProfileService profileService;
    private final UserRepository userRepository;

    public ProfileController(ProfileService profileService, UserRepository userRepository) {
        this.profileService = profileService;
        this.userRepository = userRepository;
    }

    @GetMapping("/me")
    @Operation(summary = "Get own profile", description = "Fetches the authenticated user's profile details.")
    public ResponseEntity<?> getMyProfile(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));
                
        Optional<Profile> profileOpt = profileService.getProfileByUserId(user.getId());
        if (profileOpt.isPresent()) {
            return ResponseEntity.ok(profileOpt.get());
        }
        
        // Return mostly empty profile if it doesn't exist yet
        Profile emptyProfile = new Profile();
        emptyProfile.setUserId(user.getId());
        return ResponseEntity.ok(emptyProfile);
    }

    @GetMapping("/{userId}")
    @Operation(summary = "Get a user's profile", description = "Fetches a specific user's profile details by userId. Respects profile picture visibility settings.")
    public ResponseEntity<?> getUserProfile(
            @PathVariable String userId,
            @AuthenticationPrincipal UserDetails userDetails) {
        Optional<Profile> profileOpt = profileService.getProfileByUserId(userId);
        
        Profile profile;
        if (profileOpt.isPresent()) {
            profile = profileOpt.get();
        } else {
            profile = new Profile();
            profile.setUserId(userId);
            return ResponseEntity.ok(profile);
        }

        // Check if the requester is the profile owner
        boolean isOwner = false;
        if (userDetails != null) {
            Optional<User> requester = userRepository.findByUsername(userDetails.getUsername());
            if (requester.isPresent() && requester.get().getId().equals(userId)) {
                isOwner = true;
            }
        }

        // If not the owner, respect visibility settings
        if (!isOwner) {
            String visibility = profile.getProfilePicVisibility();
            if ("NOBODY".equals(visibility)) {
                profile.setAvatarUrl(null);
            }
            // CONTACTS would need a contacts list - treat same as EVERYONE for now
        }

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
        try {
            User user = userRepository.findByUsername(userDetails.getUsername())
                    .orElseThrow(() -> new RuntimeException("User not found"));
                    
            if (!user.getId().equals(userId) && !user.getUsername().equals(userId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Not authorized to update this profile"));
            }
                    
            Profile updated = profileService.updateProfile(userId, payload);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
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
        try {
            User user = userRepository.findByUsername(userDetails.getUsername())
                    .orElseThrow(() -> new RuntimeException("User not found"));

            if (!user.getId().equals(userId) && !user.getUsername().equals(userId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Not authorized to upload avatar for this profile"));
            }

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
        try {
            User user = userRepository.findByUsername(userDetails.getUsername())
                    .orElseThrow(() -> new RuntimeException("User not found"));
                    
            if (!user.getId().equals(userId) && !user.getUsername().equals(userId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Not authorized to modify this profile"));
            }
                    
            profileService.removeAvatar(userId);
            return ResponseEntity.ok(Map.of("message", "Profile picture removed successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{userId}")
    @Operation(summary = "Remove profile", description = "Deletes the entire profile document (avatarUrl and bio) for the specified user.")
    public ResponseEntity<?> removeProfile(
            @PathVariable String userId,
            @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        try {
            User user = userRepository.findByUsername(userDetails.getUsername())
                    .orElseThrow(() -> new RuntimeException("User not found"));
                    
            if (!user.getId().equals(userId) && !user.getUsername().equals(userId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Not authorized to delete this profile"));
            }
                    
            profileService.removeProfile(userId);
            return ResponseEntity.ok(Map.of("message", "Profile removed successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
