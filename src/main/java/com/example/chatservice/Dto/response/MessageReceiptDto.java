package com.example.chatservice.Dto.response;

import java.time.Instant;

public record MessageReceiptDto(
        String userId,
        String username,
        String displayName,
        String status,
        Instant deliveredAt,
        Instant seenAt) {
}
