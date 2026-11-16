package com.uit.cinema.chatbot.service;

import java.util.UUID;

public record Citation(
    UUID passageId,
    UUID sourceId,
    String title,
    String locator,
    String text
) {
}
