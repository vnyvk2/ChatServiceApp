package com.example.chatservice.Dto.response;

import com.example.chatservice.Model.User;
import java.time.Instant;

public record MessageDto(
        String id,
        SenderDto sender,
        String text, // Decrypted text
        Instant createdAt) {
    public record SenderDto(String username, String displayName, User.UserStatus status) {
    }
}
