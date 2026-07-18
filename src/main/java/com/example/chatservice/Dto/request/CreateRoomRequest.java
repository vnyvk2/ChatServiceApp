package com.example.chatservice.Dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateRoomRequest(
        @NotBlank @Size(min = 1, max = 100) String name,
        @Size(max = 500) String description,
        String roomType,
        boolean isPrivate,
        String password) {
}
