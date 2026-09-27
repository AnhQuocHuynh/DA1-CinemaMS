package com.uit.cinema.booking.messaging;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.MissingNode;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.UUID;

@Component
public class PaymentEventEnvelopeReader {

    static final String PAYMENT_SOURCE = "payment-service";
    static final int SCHEMA_VERSION = 1;

    private final ObjectMapper objectMapper;

    public PaymentEventEnvelopeReader(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public PaymentEventEnvelope read(String message) {
        JsonNode root = parseObject(message);
        UUID eventId = requiredUuid(root, "eventId", "EventId");
        String eventType = requiredText(root, "eventType", "EventType");
        Instant occurredAt = requiredInstant(root, "occurredAt", "OccurredAt");
        int schemaVersion = requiredInt(root, "schemaVersion", "SchemaVersion");
        String source = requiredText(root, "source", "Source");
        JsonNode payload = requiredObject(root, "payload", "Payload");

        if (schemaVersion != SCHEMA_VERSION) {
            throw poison("Unsupported event schema version: " + schemaVersion);
        }
        if (!PAYMENT_SOURCE.equals(source)) {
            throw poison("Unexpected event source: " + source);
        }
        return new PaymentEventEnvelope(eventId, eventType, occurredAt, schemaVersion, source, payload);
    }

    public PaymentCompletedPayload completedPayload(JsonNode payload) {
        return new PaymentCompletedPayload(
            optionalUuid(payload, "correlationId", "CorrelationId"),
            optionalLong(payload, "paymentId", "PaymentId"),
            requiredLong(payload, "orderId", "OrderId"),
            optionalLong(payload, "userId", "UserId"),
            optionalDecimal(payload, "amount", "Amount"),
            optionalText(payload, "transactionId", "TransactionId"),
            optionalText(payload, "paymentMethod", "PaymentMethod"),
            optionalInstant(payload, "paidAt", "PaidAt")
        );
    }

    public PaymentFailedPayload failedPayload(JsonNode payload) {
        return new PaymentFailedPayload(
            optionalUuid(payload, "correlationId", "CorrelationId"),
            optionalLong(payload, "paymentId", "PaymentId"),
            requiredLong(payload, "orderId", "OrderId"),
            optionalLong(payload, "userId", "UserId"),
            optionalText(payload, "reason", "Reason")
        );
    }

    public PaymentRefundedPayload refundedPayload(JsonNode payload) {
        return new PaymentRefundedPayload(
            optionalUuid(payload, "correlationId", "CorrelationId"),
            optionalLong(payload, "paymentId", "PaymentId"),
            requiredLong(payload, "orderId", "OrderId"),
            optionalLong(payload, "userId", "UserId"),
            optionalDecimal(payload, "refundAmount", "RefundAmount"),
            optionalText(payload, "reason", "Reason")
        );
    }

    private JsonNode parseObject(String message) {
        try {
            JsonNode root = objectMapper.readTree(message);
            if (root == null || !root.isObject()) {
                throw poison("Event envelope must be a JSON object");
            }
            return root;
        } catch (JsonProcessingException exception) {
            throw poison("Event envelope is not valid JSON", exception);
        }
    }

    private JsonNode field(JsonNode node, String... names) {
        for (String name : names) {
            JsonNode value = node.get(name);
            if (value != null && !value.isNull()) {
                return value;
            }
        }
        return MissingNode.getInstance();
    }

    private JsonNode requiredObject(JsonNode node, String... names) {
        JsonNode value = field(node, names);
        if (value.isMissingNode() || !value.isObject()) {
            throw poison("Missing object field: " + names[0]);
        }
        return value;
    }

    private String requiredText(JsonNode node, String... names) {
        JsonNode value = field(node, names);
        if (value.isMissingNode() || value.asText().isBlank()) {
            throw poison("Missing text field: " + names[0]);
        }
        return value.asText();
    }

    private String optionalText(JsonNode node, String... names) {
        JsonNode value = field(node, names);
        if (value.isMissingNode() || value.asText().isBlank()) {
            return null;
        }
        return value.asText();
    }

    private int requiredInt(JsonNode node, String... names) {
        JsonNode value = field(node, names);
        if (value.isMissingNode() || !value.canConvertToInt()) {
            throw poison("Missing integer field: " + names[0]);
        }
        return value.asInt();
    }

    private Long requiredLong(JsonNode node, String... names) {
        JsonNode value = field(node, names);
        if (value.isMissingNode() || !value.canConvertToLong()) {
            throw poison("Missing numeric field: " + names[0]);
        }
        return value.asLong();
    }

    private Long optionalLong(JsonNode node, String... names) {
        JsonNode value = field(node, names);
        if (value.isMissingNode() || value.isNull() || !value.canConvertToLong()) {
            return null;
        }
        return value.asLong();
    }

    private UUID requiredUuid(JsonNode node, String... names) {
        try {
            return UUID.fromString(requiredText(node, names));
        } catch (IllegalArgumentException exception) {
            throw poison("Invalid UUID field: " + names[0], exception);
        }
    }

    private UUID optionalUuid(JsonNode node, String... names) {
        String text = optionalText(node, names);
        if (text == null) {
            return null;
        }
        try {
            return UUID.fromString(text);
        } catch (IllegalArgumentException exception) {
            throw poison("Invalid UUID field: " + names[0], exception);
        }
    }

    private Instant requiredInstant(JsonNode node, String... names) {
        Instant parsed = optionalInstant(node, names);
        if (parsed == null) {
            throw poison("Missing timestamp field: " + names[0]);
        }
        return parsed;
    }

    private Instant optionalInstant(JsonNode node, String... names) {
        String text = optionalText(node, names);
        if (text == null) {
            return null;
        }
        try {
            return Instant.parse(text);
        } catch (DateTimeParseException ignored) {
            // fall through
        }
        try {
            return OffsetDateTime.parse(text).toInstant();
        } catch (DateTimeParseException ignored) {
            // fall through
        }
        try {
            return LocalDateTime.parse(text).toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException exception) {
            throw poison("Invalid timestamp field: " + names[0], exception);
        }
    }

    private BigDecimal optionalDecimal(JsonNode node, String... names) {
        JsonNode value = field(node, names);
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }
        if (value.isNumber()) {
            return value.decimalValue();
        }
        if (value.isTextual() && !value.asText().isBlank()) {
            try {
                return new BigDecimal(value.asText());
            } catch (NumberFormatException exception) {
                throw poison("Invalid decimal field: " + names[0], exception);
            }
        }
        return null;
    }

    static IllegalArgumentException poison(String message) {
        return new IllegalArgumentException(message);
    }

    static IllegalArgumentException poison(String message, Throwable cause) {
        return new IllegalArgumentException(message, cause);
    }
}
