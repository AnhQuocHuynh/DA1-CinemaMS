package com.uit.cinema.core.outbox;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class TransactionalOutboxTest {

    @Mock
    private OutboxEventRepository outboxEventRepository;

    @Captor
    private ArgumentCaptor<OutboxEvent> eventCaptor;

    @Test
    void append_persistsVersionedPendingEnvelope() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
        TransactionalOutbox outbox = new TransactionalOutbox(outboxEventRepository, objectMapper);

        outbox.append(
            "catalog-service",
            "catalog.events",
            "movie.created",
            "movie",
            15L,
            Map.of("movieId", 15L)
        );

        verify(outboxEventRepository).save(eventCaptor.capture());
        OutboxEvent event = eventCaptor.getValue();
        JsonNode envelope = objectMapper.readTree(event.getPayload());

        assertNotNull(event.getEventId());
        assertEquals(OutboxEvent.OutboxStatus.PENDING, event.getStatus());
        assertEquals("catalog.events", event.getExchangeName());
        assertEquals("movie.created", event.getRoutingKey());
        assertEquals("movie.created", envelope.get("eventType").asText());
        assertEquals(1, envelope.get("schemaVersion").asInt());
        assertEquals("catalog-service", envelope.get("source").asText());
        assertEquals(15L, envelope.get("payload").get("movieId").asLong());
    }
}

