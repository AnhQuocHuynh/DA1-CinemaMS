package com.uit.cinema.chatbot.api;

import jakarta.validation.constraints.Size;

public record CreateConversationRequest(
    @Size(max = 255) String title
) {
}
