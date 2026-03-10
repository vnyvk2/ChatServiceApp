package com.example.chatservice.service;

import com.example.chatservice.Model.Profile;
import com.example.chatservice.repository.ProfileRepository;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

@Service
public class ProfileService {

    private final ProfileRepository profileRepository;

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

        return profileRepository.save(profile);
    }

    public void removeAvatar(String userId) {
        profileRepository.findByUserId(userId).ifPresent(profile -> {
            profile.setAvatarUrl(null);
            profileRepository.save(profile);
        });
    }

    public void removeProfile(String userId) {
        profileRepository.deleteByUserId(userId);
    }
}
