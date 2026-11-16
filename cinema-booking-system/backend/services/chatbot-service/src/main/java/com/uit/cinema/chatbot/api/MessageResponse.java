package com.uit.cinema.chatbot.api;

import com.uit.cinema.chatbot.service.Citation;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record MessageResponse(
    UUID id,
    String sender,
    String content,
    List<Citation> citations,
    Instant createdAt
) {
}
