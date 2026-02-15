// Create a new file: MessageDto.java
package com.example.chatservice.web; // Or a similar package

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