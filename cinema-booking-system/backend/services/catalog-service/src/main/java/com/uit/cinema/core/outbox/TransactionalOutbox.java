package com.uit.cinema.core.outbox;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

/**
 * Stores a transport-neutral event in the same transaction as the domain write.
 * A future dispatcher is the only component allowed to publish these rows.
 */
@Service
@RequiredArgsConstructor
public class TransactionalOutbox {

    private static final int CURRENT_SCHEMA_VERSION = 1;

    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;

    public void append(
        String source,
        String exchangeName,
        String routingKey,
        String aggregateType,
        Long aggregateId,
        Object payload
    ) {
        UUID eventId = UUID.randomUUID();
        Instant occurredAt = Instant.now();
        String eventType = routingKey;
        String envelope = serialize(new EventEnvelope(
            eventId,
            eventType,
            occurredAt,
            CURRENT_SCHEMA_VERSION,
            source,
            payload
        ));

        outboxEventRepository.save(OutboxEvent.builder()
            .eventId(eventId)
            .eventType(eventType)
            .exchangeName(exchangeName)
            .routingKey(routingKey)
            .aggregateType(aggregateType)
            .aggregateId(aggregateId)
            .schemaVersion(CURRENT_SCHEMA_VERSION)
            .occurredAt(occurredAt)
            .payload(envelope)
            .nextAttemptAt(occurredAt)
            .build());
    }

    private String serialize(EventEnvelope envelope) {
        try {
            return objectMapper.writeValueAsString(envelope);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize transactional outbox event", exception);
        }
    }

    private record EventEnvelope(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        int schemaVersion,
        String source,
        Object payload
    ) {
    }
}

