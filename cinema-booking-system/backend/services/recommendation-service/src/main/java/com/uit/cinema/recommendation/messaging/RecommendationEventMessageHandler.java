package com.uit.cinema.recommendation.messaging;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uit.cinema.recommendation.service.UserRatingService;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
@ConditionalOnProperty(
    name = {"recommendation.messaging.enabled", "recommendation.graph.enabled"},
    havingValue = "true"
)
public class RecommendationEventMessageHandler {

    private static final Logger log = LoggerFactory.getLogger(RecommendationEventMessageHandler.class);

    private static final Set<String> SUPPORTED_EVENT_TYPES = Set.of(
        "order.paid",
        "order.refunded",
        "review.created",
        "movie.created",
        "movie.updated",
        "movie.deleted"
    );

    private final ObjectMapper objectMapper;
    private final RecommendationEventProjectionStore projectionStore;
    private final UserRatingService userRatingService;
    private final Counter projectedCounter;
    private final Counter duplicateCounter;
    private final Counter rejectedCounter;

    public RecommendationEventMessageHandler(
        ObjectMapper objectMapper,
        RecommendationEventProjectionStore projectionStore,
        MeterRegistry meterRegistry,
        UserRatingService userRatingService
    ) {
        this.objectMapper = objectMapper;
        this.projectionStore = projectionStore;
        this.userRatingService = userRatingService;
        this.projectedCounter = meterRegistry.counter("cinema.recommendation.events", "outcome", "projected");
        this.duplicateCounter = meterRegistry.counter("cinema.recommendation.events", "outcome", "duplicate");
        this.rejectedCounter = meterRegistry.counter("cinema.recommendation.events", "outcome", "rejected");
    }

    @RabbitListener(queues = "${recommendation.messaging.catalog-queue:recommendation.catalog.v1}")
    public void consumeCatalogEvent(String message) {
        consume(message, "catalog-service");
    }

    @RabbitListener(queues = "${recommendation.messaging.booking-queue:recommendation.booking.v1}")
    public void consumeBookingEvent(String message) {
        consume(message, "booking-service");
    }

    void consume(String message, String expectedSource) {
        JsonNode envelope = readEnvelope(message);
        validateEnvelope(envelope, expectedSource);
        if (projectionStore.project(envelope)) {
            projectedCounter.increment();
            syncUserRatingIfMovieReview(envelope);
        } else {
            duplicateCounter.increment();
        }
    }

    private void syncUserRatingIfMovieReview(JsonNode envelope) {
        if (!"review.created".equals(envelope.path("eventType").asText())) {
            return;
        }
        JsonNode payload = envelope.path("payload");
        if (!"VISIBLE".equalsIgnoreCase(payload.path("status").asText())) {
            return;
        }
        if (!payload.hasNonNull("userId") || !payload.hasNonNull("movieId") || !payload.hasNonNull("rating")) {
            return;
        }
        long userId = payload.path("userId").asLong(-1);
        long movieId = payload.path("movieId").asLong(-1);
        double rating = payload.path("rating").asDouble(Double.NaN);
        if (userId <= 0 || movieId <= 0 || Double.isNaN(rating) || rating < 1.0 || rating > 5.0) {
            return;
        }
        try {
            userRatingService.upsert(userId, movieId, rating);
        } catch (RuntimeException ex) {
            log.warn(
                "Failed to sync review.created rating into user_ratings for userId={} movieId={}",
                userId,
                movieId,
                ex
            );
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
            throw rejected("Unsupported recommendation event type: " + eventType, null);
        }
    }

    private IllegalArgumentException rejected(String message, Exception cause) {
        rejectedCounter.increment();
        return cause == null
            ? new IllegalArgumentException(message)
            : new IllegalArgumentException(message, cause);
    }
}
