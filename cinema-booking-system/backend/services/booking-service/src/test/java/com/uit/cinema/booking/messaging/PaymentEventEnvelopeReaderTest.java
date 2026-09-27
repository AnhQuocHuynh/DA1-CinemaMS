package com.uit.cinema.booking.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PaymentEventEnvelopeReaderTest {

    private PaymentEventEnvelopeReader reader;

    @BeforeEach
    void setUp() {
        reader = new PaymentEventEnvelopeReader(new ObjectMapper());
    }

    @Test
    void readsCamelCaseEnvelopeAndPayload() {
        PaymentEventEnvelope envelope = reader.read("""
            {
              "eventId": "550e8400-e29b-41d4-a716-446655440001",
              "eventType": "payment.completed",
              "occurredAt": "2026-08-20T12:00:00Z",
              "schemaVersion": 1,
              "source": "payment-service",
              "payload": {
                "correlationId": "550e8400-e29b-41d4-a716-4466554400aa",
                "paymentId": 42,
                "orderId": 101,
                "userId": 7,
                "amount": 350000.00,
                "transactionId": "txn_stripe_abc123",
                "paymentMethod": "STRIPE",
                "paidAt": "2026-08-20T12:00:00Z"
              }
            }
            """);

        assertThat(envelope.eventId()).isEqualTo(UUID.fromString("550e8400-e29b-41d4-a716-446655440001"));
        PaymentCompletedPayload payload = reader.completedPayload(envelope.payload());
        assertThat(payload.orderId()).isEqualTo(101L);
        assertThat(payload.amount()).isEqualByComparingTo(new BigDecimal("350000.00"));
        assertThat(payload.transactionId()).isEqualTo("txn_stripe_abc123");
    }

    @Test
    void readsPascalCaseEnvelopeAndUtcLocalDateTime() {
        PaymentEventEnvelope envelope = reader.read("""
            {
              "EventId": "550e8400-e29b-41d4-a716-446655440002",
              "EventType": "payment.failed",
              "OccurredAt": "2026-08-20T12:05:00",
              "SchemaVersion": 1,
              "Source": "payment-service",
              "Payload": {
                "OrderId": 102,
                "UserId": 8,
                "Reason": "Card declined"
              }
            }
            """);

        assertThat(envelope.eventType()).isEqualTo("payment.failed");
        assertThat(envelope.occurredAt()).hasToString("2026-08-20T12:05:00Z");
        assertThat(reader.failedPayload(envelope.payload()).orderId()).isEqualTo(102L);
    }

    @Test
    void rejectsWrongSourceAndSchema() {
        assertThatThrownBy(() -> reader.read("""
            {
              "eventId": "550e8400-e29b-41d4-a716-446655440003",
              "eventType": "payment.completed",
              "occurredAt": "2026-08-20T12:00:00Z",
              "schemaVersion": 2,
              "source": "payment-service",
              "payload": { "orderId": 1 }
            }
            """))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("schema version");

        assertThatThrownBy(() -> reader.read("""
            {
              "eventId": "550e8400-e29b-41d4-a716-446655440004",
              "eventType": "payment.completed",
              "occurredAt": "2026-08-20T12:00:00Z",
              "schemaVersion": 1,
              "source": "booking-service",
              "payload": { "orderId": 1 }
            }
            """))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("source");
    }

    @Test
    void rejectsInvalidJson() {
        assertThatThrownBy(() -> reader.read("{not-json"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("not valid JSON");
    }
}
