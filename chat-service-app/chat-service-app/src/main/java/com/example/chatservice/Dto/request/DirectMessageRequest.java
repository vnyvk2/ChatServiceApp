package com.example.chatservice.Dto.request;

public record DirectMessageRequest(
        String phoneNumber,
        String username) {

    public boolean isValid() {
        return (phoneNumber != null && !phoneNumber.trim().isEmpty()) ||
                (username != null && !username.trim().isEmpty());
    }
}
