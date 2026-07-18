package com.example.chatservice.Dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateRoomWithOptionsRequest(
        @NotBlank @Size(min = 1, max = 100) String name,
        @Size(max = 500) String description,
        boolean isPrivate,
        String password,
        List<String> initialMembers) {
}
