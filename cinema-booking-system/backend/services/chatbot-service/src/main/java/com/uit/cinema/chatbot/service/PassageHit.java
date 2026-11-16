package com.uit.cinema.chatbot.service;

import java.util.UUID;

public record PassageHit(
    UUID passageId,
    UUID sourceId,
    String title,
    String locator,
    String text,
    String metadata,
    double distance
) {
}
