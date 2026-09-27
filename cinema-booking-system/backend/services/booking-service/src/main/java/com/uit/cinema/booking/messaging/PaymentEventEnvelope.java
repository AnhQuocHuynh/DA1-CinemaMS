package com.uit.cinema.booking.messaging;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

public record PaymentEventEnvelope(
    UUID eventId,
    String eventType,
    Instant occurredAt,
    int schemaVersion,
    String source,
    JsonNode payload
) {
}
