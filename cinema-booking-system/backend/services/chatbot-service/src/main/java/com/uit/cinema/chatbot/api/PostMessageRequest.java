package com.uit.cinema.chatbot.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PostMessageRequest(
    @NotBlank @Size(max = 1000) String message
) {
}
