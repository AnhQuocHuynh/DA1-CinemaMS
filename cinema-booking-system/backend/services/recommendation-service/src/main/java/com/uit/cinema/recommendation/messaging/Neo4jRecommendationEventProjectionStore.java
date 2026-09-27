package com.uit.cinema.recommendation.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Session;
import org.neo4j.driver.TransactionContext;
import org.neo4j.driver.Values;
import org.neo4j.driver.exceptions.ClientException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Repository
@ConditionalOnProperty(name = "recommendation.graph.enabled", havingValue = "true")
public class Neo4jRecommendationEventProjectionStore implements RecommendationEventProjectionStore {

    private static final String CLAIM_EVENT = """
        CREATE (:ProcessedEvent {
            eventId: $eventId,
            eventType: $eventType,
            occurredAt: datetime($occurredAt)
        })
        """;

    private static final String UPSERT_MOVIE = """
        MERGE (movie:Movie {movieId: $movieId})
        WITH movie
        WHERE movie.updatedAt IS NULL OR movie.updatedAt <= datetime($occurredAt)
        SET movie.title = $title,
            movie.posterUrl = $posterUrl,
            movie.active = $active,
            movie.updatedAt = datetime($occurredAt)
        WITH movie
        OPTIONAL MATCH (movie)-[oldGenre:IN_GENRE]->(:Genre)
        DELETE oldGenre
        WITH movie
        UNWIND $genreNames AS genreName
        MERGE (genre:Genre {name: genreName})
        MERGE (movie)-[:IN_GENRE]->(genre)
        """;

    private static final String UPSERT_PAID_ORDER = """
        MERGE (order:OrderInteraction {orderId: $orderId})
        ON CREATE SET order.updatedAt = datetime('1970-01-01T00:00:00Z')
        WITH order
        WHERE order.updatedAt <= datetime($occurredAt)
        SET order.status = 'PAID',
            order.showtimeId = $showtimeId,
            order.updatedAt = datetime($occurredAt)
        MERGE (user:User {userId: $userId})
        MERGE (movie:Movie {movieId: $movieId})
        ON CREATE SET movie.title = 'Movie ' + toString($movieId), movie.active = true
        MERGE (user)-[:PLACED]->(order)
        MERGE (order)-[:FOR_MOVIE]->(movie)
        MERGE (user)-[watched:WATCHED {orderId: $orderId}]->(movie)
        SET watched.showtimeId = $showtimeId,
            watched.occurredAt = datetime($occurredAt)
        """;

    private static final String APPLY_REFUND = """
        MERGE (order:OrderInteraction {orderId: $orderId})
        ON CREATE SET order.updatedAt = datetime('1970-01-01T00:00:00Z')
        WITH order
        WHERE order.updatedAt <= datetime($occurredAt)
        SET order.status = 'REFUNDED',
            order.updatedAt = datetime($occurredAt)
        WITH order
        OPTIONAL MATCH ()-[watched:WATCHED {orderId: $orderId}]->()
        DELETE watched
        """;

    private static final String UPSERT_VISIBLE_REVIEW = """
        MERGE (review:ReviewInteraction {reviewId: $reviewId})
        ON CREATE SET review.updatedAt = datetime('1970-01-01T00:00:00Z')
        WITH review
        WHERE review.updatedAt <= datetime($occurredAt)
        SET review.status = 'VISIBLE',
            review.updatedAt = datetime($occurredAt)
        MERGE (user:User {userId: $userId})
        MERGE (movie:Movie {movieId: $movieId})
        ON CREATE SET movie.title = 'Movie ' + toString($movieId), movie.active = true
        MERGE (user)-[:AUTHORED]->(review)
        MERGE (review)-[:FOR_MOVIE]->(movie)
        MERGE (user)-[rated:RATED {reviewId: $reviewId}]->(movie)
        SET rated.rating = $rating,
            rated.occurredAt = datetime($occurredAt)
        """;

    private static final String HIDE_REVIEW = """
        MERGE (review:ReviewInteraction {reviewId: $reviewId})
        ON CREATE SET review.updatedAt = datetime('1970-01-01T00:00:00Z')
        WITH review
        WHERE review.updatedAt <= datetime($occurredAt)
        SET review.status = $status,
            review.updatedAt = datetime($occurredAt)
        WITH review
        OPTIONAL MATCH ()-[rated:RATED {reviewId: $reviewId}]->()
        DELETE rated
        """;

    private final Driver driver;

    public Neo4jRecommendationEventProjectionStore(Driver driver) {
        this.driver = driver;
    }

    @Override
    public boolean project(JsonNode envelope) {
        UUID eventId = UUID.fromString(requiredText(envelope, "eventId"));
        String eventType = requiredText(envelope, "eventType");
        Instant occurredAt = Instant.parse(requiredText(envelope, "occurredAt"));
        JsonNode payload = requiredObject(envelope, "payload");

        try (Session session = driver.session()) {
            return session.executeWrite(transaction -> {
                transaction.run(CLAIM_EVENT, Values.value(Map.of(
                    "eventId", eventId.toString(),
                    "eventType", eventType,
                    "occurredAt", occurredAt.toString()
                ))).consume();
                apply(transaction, eventType, occurredAt, payload);
                return true;
            });
        } catch (ClientException exception) {
            if ("Neo.ClientError.Schema.ConstraintValidationFailed".equals(exception.code())) {
                return false;
            }
            throw exception;
        }
    }

    private void apply(TransactionContext transaction, String eventType, Instant occurredAt, JsonNode payload) {
        switch (eventType) {
            case "movie.created", "movie.updated", "movie.deleted" ->
                transaction.run(UPSERT_MOVIE, Values.value(movieParameters(payload, occurredAt))).consume();
            case "order.paid" -> applyPaidOrder(transaction, payload, occurredAt);
            case "order.refunded" -> transaction.run(APPLY_REFUND, Values.value(Map.of(
                "orderId", requiredLong(payload, "orderId"),
                "occurredAt", occurredAt.toString()
            ))).consume();
            case "review.created" -> applyReview(transaction, payload, occurredAt);
            default -> throw new IllegalArgumentException("Unsupported recommendation event type: " + eventType);
        }
    }

    private void applyPaidOrder(TransactionContext transaction, JsonNode payload, Instant occurredAt) {
        Long movieId = optionalLong(payload, "movieId");
        if (movieId == null) {
            return;
        }
        transaction.run(UPSERT_PAID_ORDER, Values.value(Map.of(
            "orderId", requiredLong(payload, "orderId"),
            "userId", requiredLong(payload, "userId"),
            "showtimeId", requiredLong(payload, "showtimeId"),
            "movieId", movieId,
            "occurredAt", occurredAt.toString()
        ))).consume();
    }

    private void applyReview(TransactionContext transaction, JsonNode payload, Instant occurredAt) {
        Long movieId = optionalLong(payload, "movieId");
        long reviewId = requiredLong(payload, "reviewId");
        String status = requiredText(payload, "status");
        if (movieId == null || !"VISIBLE".equals(status)) {
            transaction.run(HIDE_REVIEW, Values.value(Map.of(
                "reviewId", reviewId,
                "status", status,
                "occurredAt", occurredAt.toString()
            ))).consume();
            return;
        }
        int rating = requiredInt(payload, "rating");
        if (rating < 1 || rating > 5) {
            throw new IllegalArgumentException("Review rating must be between 1 and 5");
        }
        transaction.run(UPSERT_VISIBLE_REVIEW, Values.value(Map.of(
            "reviewId", reviewId,
            "userId", requiredLong(payload, "userId"),
            "movieId", movieId,
            "rating", rating,
            "occurredAt", occurredAt.toString()
        ))).consume();
    }

    private Map<String, Object> movieParameters(JsonNode payload, Instant occurredAt) {
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("movieId", requiredLong(payload, "movieId"));
        parameters.put("title", requiredText(payload, "title"));
        parameters.put("posterUrl", optionalText(payload, "posterUrl"));
        parameters.put("active", payload.path("active").asBoolean(true));
        parameters.put("occurredAt", occurredAt.toString());
        parameters.put("genreNames", stringList(payload, "genreNames"));
        return parameters;
    }

    private JsonNode requiredObject(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || !value.isObject()) {
            throw new IllegalArgumentException("Missing object field: " + field);
        }
        return value;
    }

    private String requiredText(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull() || value.asText().isBlank()) {
            throw new IllegalArgumentException("Missing text field: " + field);
        }
        return value.asText();
    }

    private String optionalText(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private long requiredLong(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || !value.canConvertToLong()) {
            throw new IllegalArgumentException("Missing numeric field: " + field);
        }
        return value.asLong();
    }

    private Long optionalLong(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asLong();
    }

    private int requiredInt(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || !value.canConvertToInt()) {
            throw new IllegalArgumentException("Missing integer field: " + field);
        }
        return value.asInt();
    }

    private List<String> stringList(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || !value.isArray()) {
            return List.of();
        }
        List<String> items = new ArrayList<>();
        value.forEach(item -> {
            if (item.isTextual() && !item.asText().isBlank()) {
                items.add(item.asText());
            }
        });
        return List.copyOf(items);
    }
}
