package com.example.chatservice.payload.response;

import com.example.chatservice.domain.User;
import java.time.Instant;

public record MessageDto(
        String id,
        SenderDto sender,
        String text, // Decrypted text
        Instant createdAt) {
    public record SenderDto(String username, String displayName, User.UserStatus status) {
    }
}
