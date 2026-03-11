package com.example.chatservice.service;

import com.example.chatservice.Model.Profile;
import com.example.chatservice.repository.ProfileRepository;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class ProfileService {

    private final ProfileRepository profileRepository;

    @Value("${app.upload.dir:uploads/avatars}")
    private String uploadDir;

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp"
    );

    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    public ProfileService(ProfileRepository profileRepository) {
        this.profileRepository = profileRepository;
    }

    public Optional<Profile> getProfileByUserId(String userId) {
        return profileRepository.findByUserId(userId);
    }

    public Profile updateProfile(String userId, Map<String, String> updates) {
        Profile profile = profileRepository.findByUserId(userId)
                .orElseGet(() -> {
                    Profile newProfile = new Profile();
                    newProfile.setUserId(userId);
                    return newProfile;
                });

        if (updates.containsKey("avatarUrl")) {
            profile.setAvatarUrl(updates.get("avatarUrl"));
        }
        if (updates.containsKey("bio")) {
            profile.setBio(updates.get("bio"));
        }
        if (updates.containsKey("profilePicVisibility")) {
            String visibility = updates.get("profilePicVisibility");
            if ("EVERYONE".equals(visibility) || "CONTACTS".equals(visibility) || "NOBODY".equals(visibility)) {
                profile.setProfilePicVisibility(visibility);
            }
        }

        return profileRepository.save(profile);
    }

    public Profile uploadAvatar(String userId, MultipartFile file) throws IOException {
        // Validate file type
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("Only JPEG, PNG, GIF, and WebP images are allowed");
        }

        // Validate file size
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size must be less than 5MB");
        }

        // Create upload directory if it doesn't exist
        Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(uploadPath);

        // Generate unique filename
        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        String filename = userId + "_" + System.currentTimeMillis() + extension;

        // Save the file
        Path targetPath = uploadPath.resolve(filename);
        Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

        // Update profile with the new avatar URL
        Profile profile = profileRepository.findByUserId(userId)
                .orElseGet(() -> {
                    Profile newProfile = new Profile();
                    newProfile.setUserId(userId);
                    return newProfile;
                });

        // Delete old avatar file if it exists
        String oldAvatarUrl = profile.getAvatarUrl();
        if (oldAvatarUrl != null && oldAvatarUrl.startsWith("/uploads/avatars/")) {
            try {
                String oldFilename = oldAvatarUrl.substring("/uploads/avatars/".length());
                Path oldFilePath = uploadPath.resolve(oldFilename);
                Files.deleteIfExists(oldFilePath);
            } catch (Exception e) {
                // Ignore errors deleting old file
            }
        }

        String avatarUrl = "/uploads/avatars/" + filename;
        profile.setAvatarUrl(avatarUrl);
        return profileRepository.save(profile);
    }

    public void removeAvatar(String userId) {
        profileRepository.findByUserId(userId).ifPresent(profile -> {
            // Delete the file from disk
            String avatarUrl = profile.getAvatarUrl();
            if (avatarUrl != null && avatarUrl.startsWith("/uploads/avatars/")) {
                try {
                    Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
                    String filename = avatarUrl.substring("/uploads/avatars/".length());
                    Path filePath = uploadPath.resolve(filename);
                    Files.deleteIfExists(filePath);
                } catch (Exception e) {
                    // Ignore errors deleting file
                }
            }
            profile.setAvatarUrl(null);
            profileRepository.save(profile);
        });
    }

    public void removeProfile(String userId) {
        profileRepository.deleteByUserId(userId);
    }
}
