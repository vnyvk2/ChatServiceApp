package com.example.chatservice.payload.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DataRequest {

    @NotBlank(message = "Title is required")
    private String title;

    @NotBlank(message = "Content is required")
    private String content;
}
