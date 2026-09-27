package com.uit.cinema.analytics.projection;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Applies versioned domain events to the Analytics read model.
 * The future AMQP listener must delegate here and acknowledge only after this
 * transaction commits.
 */
@Service
@ConditionalOnProperty(name = "analytics.read-model.enabled", havingValue = "true")
public class AnalyticsEventProjectionService {

    private final JdbcTemplate jdbcTemplate;

    public AnalyticsEventProjectionService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public boolean project(JsonNode envelope) {
        UUID eventId = UUID.fromString(requiredText(envelope, "eventId"));
        String eventType = requiredText(envelope, "eventType");
        Instant occurredAt = Instant.parse(requiredText(envelope, "occurredAt"));
        JsonNode payload = requiredObject(envelope, "payload");

        if (!claim(eventId, eventType, occurredAt)) {
            return false;
        }

        switch (eventType) {
            case "order.paid" -> projectPaidOrder(payload, occurredAt);
            case "order.refunded" -> projectRefundedOrder(payload, occurredAt);
            case "movie.created", "movie.updated", "movie.deleted" -> projectMovie(payload, occurredAt);
            default -> throw new IllegalArgumentException("Unsupported analytics event type: " + eventType);
        }
        return true;
    }

    private boolean claim(UUID eventId, String eventType, Instant occurredAt) {
        if (isH2()) {
            return claimForH2(eventId, eventType, occurredAt);
        }
        try {
            return jdbcTemplate.update(
                """
                INSERT INTO analytics_processed_events (event_id, event_type, processed_at)
                VALUES (?, ?, ?)
                ON CONFLICT (event_id) DO NOTHING
                """,
                eventId,
                eventType,
                Timestamp.from(occurredAt)
            ) == 1;
        } catch (DuplicateKeyException ignored) {
            return false;
        }
    }

    private boolean claimForH2(UUID eventId, String eventType, Instant occurredAt) {
        Integer existing = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM analytics_processed_events WHERE event_id = ?",
            Integer.class,
            eventId
        );
        if (existing != null && existing > 0) {
            return false;
        }
        try {
            jdbcTemplate.update(
                "INSERT INTO analytics_processed_events (event_id, event_type, processed_at) VALUES (?, ?, ?)",
                eventId,
                eventType,
                Timestamp.from(occurredAt)
            );
            return true;
        } catch (DuplicateKeyException ignored) {
            return false;
        }
    }

    private void projectPaidOrder(JsonNode payload, Instant occurredAt) {
        upsertOrder(payload, "PAID", occurredAt);
    }

    private void projectRefundedOrder(JsonNode payload, Instant occurredAt) {
        upsertOrder(payload, "REFUNDED", occurredAt);
    }

    private void upsertOrder(JsonNode payload, String status, Instant occurredAt) {
        if (isH2()) {
            upsertOrderForH2(payload, status, occurredAt);
            return;
        }
        jdbcTemplate.update(
            """
            INSERT INTO analytics_orders
                (order_id, user_id, showtime_id, status, final_amount, seat_count, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (order_id) DO UPDATE SET
                user_id = EXCLUDED.user_id,
                showtime_id = EXCLUDED.showtime_id,
                status = EXCLUDED.status,
                final_amount = EXCLUDED.final_amount,
                seat_count = EXCLUDED.seat_count,
                updated_at = EXCLUDED.updated_at
            WHERE analytics_orders.updated_at IS NULL
               OR analytics_orders.updated_at <= EXCLUDED.updated_at
            """,
            requiredLong(payload, "orderId"),
            requiredLong(payload, "userId"),
            requiredLong(payload, "showtimeId"),
            status,
            requiredDecimal(payload, "finalAmount"),
            requiredInt(payload, "ticketCount"),
            Timestamp.from(occurredAt),
            Timestamp.from(occurredAt)
        );
    }

    private void upsertOrderForH2(JsonNode payload, String status, Instant occurredAt) {
        long orderId = requiredLong(payload, "orderId");
        Timestamp eventTimestamp = Timestamp.from(occurredAt);
        if (isNewerThanStored("analytics_orders", "order_id", orderId, eventTimestamp)) {
            return;
        }
        jdbcTemplate.update(
            """
            MERGE INTO analytics_orders
                (order_id, user_id, showtime_id, status, final_amount, seat_count, created_at, updated_at)
            KEY (order_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            orderId,
            requiredLong(payload, "userId"),
            requiredLong(payload, "showtimeId"),
            status,
            requiredDecimal(payload, "finalAmount"),
            requiredInt(payload, "ticketCount"),
            eventTimestamp,
            eventTimestamp
        );
    }

    private void projectMovie(JsonNode payload, Instant occurredAt) {
        if (isH2()) {
            projectMovieForH2(payload, occurredAt);
            return;
        }
        jdbcTemplate.update(
            """
            INSERT INTO analytics_contents (content_type, content_id, title, poster_url, active, updated_at)
            VALUES ('MOVIE', ?, ?, ?, ?, ?)
            ON CONFLICT (content_type, content_id) DO UPDATE SET
                title = EXCLUDED.title,
                poster_url = EXCLUDED.poster_url,
                active = EXCLUDED.active,
                updated_at = EXCLUDED.updated_at
            WHERE analytics_contents.updated_at IS NULL
               OR analytics_contents.updated_at <= EXCLUDED.updated_at
            """,
            requiredLong(payload, "movieId"),
            requiredText(payload, "title"),
            optionalText(payload, "posterUrl"),
            payload.path("active").asBoolean(true),
            Timestamp.from(occurredAt)
        );
    }

    private void projectMovieForH2(JsonNode payload, Instant occurredAt) {
        long movieId = requiredLong(payload, "movieId");
        Timestamp eventTimestamp = Timestamp.from(occurredAt);
        List<Timestamp> current = jdbcTemplate.query(
            "SELECT updated_at FROM analytics_contents WHERE content_type = 'MOVIE' AND content_id = ?",
            (resultSet, rowNum) -> resultSet.getTimestamp(1),
            movieId
        );
        if (!current.isEmpty() && current.getFirst() != null && current.getFirst().after(eventTimestamp)) {
            return;
        }
        jdbcTemplate.update(
            """
            MERGE INTO analytics_contents
                (content_type, content_id, title, poster_url, active, updated_at)
            KEY (content_type, content_id)
            VALUES ('MOVIE', ?, ?, ?, ?, ?)
            """,
            movieId,
            requiredText(payload, "title"),
            optionalText(payload, "posterUrl"),
            payload.path("active").asBoolean(true),
            eventTimestamp
        );
    }

    private boolean isNewerThanStored(String table, String idColumn, long id, Timestamp eventTimestamp) {
        List<Timestamp> current = jdbcTemplate.query(
            "SELECT updated_at FROM " + table + " WHERE " + idColumn + " = ?",
            (resultSet, rowNum) -> resultSet.getTimestamp(1),
            id
        );
        return !current.isEmpty() && current.getFirst() != null && current.getFirst().after(eventTimestamp);
    }

    private boolean isH2() {
        String databaseProduct = jdbcTemplate.execute(
            (ConnectionCallback<String>) connection -> connection.getMetaData().getDatabaseProductName()
        );
        return databaseProduct != null && databaseProduct.equalsIgnoreCase("H2");
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

    private int requiredInt(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || !value.canConvertToInt()) {
            throw new IllegalArgumentException("Missing integer field: " + field);
        }
        return value.asInt();
    }

    private BigDecimal requiredDecimal(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || !value.isNumber()) {
            throw new IllegalArgumentException("Missing decimal field: " + field);
        }
        return value.decimalValue();
    }
}
