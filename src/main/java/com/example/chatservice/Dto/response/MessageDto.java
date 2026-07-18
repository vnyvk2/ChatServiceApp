package com.example.chatservice.Dto.response;

import com.example.chatservice.Model.User;

import java.time.Instant;

public record MessageDto(
        String id,
        SenderDto sender,
        String text,
        String content,
        String status,
        Instant createdAt,
        Long timestamp,
        Instant editedAt) {
    public MessageDto(String id, SenderDto sender, String text, String status, Instant createdAt, Instant editedAt) {
        this(id, sender, text, text, status, createdAt, createdAt != null ? createdAt.toEpochMilli() : null, editedAt);
    }

    public record SenderDto(String username, String displayName, User.UserStatus status) {
    }
}
