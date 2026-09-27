package com.uit.cinema.analytics.messaging;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uit.cinema.analytics.projection.AnalyticsEventProjectionService;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
@ConditionalOnProperty(
    name = {"analytics.messaging.enabled", "analytics.read-model.enabled"},
    havingValue = "true"
)
public class AnalyticsEventMessageHandler {

    private static final Set<String> SUPPORTED_EVENT_TYPES = Set.of(
        "order.paid",
        "order.refunded",
        "movie.created",
        "movie.updated",
        "movie.deleted"
    );

    private final ObjectMapper objectMapper;
    private final AnalyticsEventProjectionService projectionService;
    private final Counter projectedCounter;
    private final Counter duplicateCounter;
    private final Counter rejectedCounter;

    public AnalyticsEventMessageHandler(
        ObjectMapper objectMapper,
        AnalyticsEventProjectionService projectionService,
        MeterRegistry meterRegistry
    ) {
        this.objectMapper = objectMapper;
        this.projectionService = projectionService;
        this.projectedCounter = meterRegistry.counter("cinema.analytics.events", "outcome", "projected");
        this.duplicateCounter = meterRegistry.counter("cinema.analytics.events", "outcome", "duplicate");
        this.rejectedCounter = meterRegistry.counter("cinema.analytics.events", "outcome", "rejected");
    }

    @RabbitListener(queues = "${analytics.messaging.catalog-queue:analytics.catalog.v1}")
    public void consumeCatalogEvent(String message) {
        consume(message, "catalog-service");
    }

    @RabbitListener(queues = "${analytics.messaging.booking-queue:analytics.booking.v1}")
    public void consumeBookingEvent(String message) {
        consume(message, "booking-service");
    }

    void consume(String message, String expectedSource) {
        JsonNode envelope = readEnvelope(message);
        validateEnvelope(envelope, expectedSource);
        if (projectionService.project(envelope)) {
            projectedCounter.increment();
        } else {
            duplicateCounter.increment();
        }
    }

    private JsonNode readEnvelope(String message) {
        try {
            JsonNode envelope = objectMapper.readTree(message);
            if (envelope == null || !envelope.isObject()) {
                throw rejected("Event envelope must be a JSON object", null);
            }
            return envelope;
        } catch (JsonProcessingException exception) {
            throw rejected("Event envelope is not valid JSON", exception);
        }
    }

    private void validateEnvelope(JsonNode envelope, String expectedSource) {
        int schemaVersion = envelope.path("schemaVersion").asInt(-1);
        if (schemaVersion != 1) {
            throw rejected("Unsupported event schema version: " + schemaVersion, null);
        }
        String source = envelope.path("source").asText();
        if (!expectedSource.equals(source)) {
            throw rejected("Unexpected event source: " + source, null);
        }
        String eventType = envelope.path("eventType").asText();
        if (!SUPPORTED_EVENT_TYPES.contains(eventType)) {
            throw rejected("Unsupported analytics event type: " + eventType, null);
        }
    }

    private IllegalArgumentException rejected(String message, Exception cause) {
        rejectedCounter.increment();
        return cause == null
            ? new IllegalArgumentException(message)
            : new IllegalArgumentException(message, cause);
    }
}
