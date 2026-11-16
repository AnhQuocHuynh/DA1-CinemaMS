package com.uit.cinema.chatbot.service;

public record CatalogDocument(
    String externalKey,
    String title,
    String body,
    String metadataJson
) {
}
