package com.example.chatservice.payload;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DataPayload {
    @NotBlank(message = "Title is required")
    private String title;

    @NotBlank(message = "Content is required")
    private String content;
}
