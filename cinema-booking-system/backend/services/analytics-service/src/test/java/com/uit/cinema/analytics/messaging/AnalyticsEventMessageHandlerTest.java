package com.uit.cinema.analytics.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uit.cinema.analytics.projection.AnalyticsEventProjectionService;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AnalyticsEventMessageHandlerTest {

    private final AnalyticsEventProjectionService projectionService = mock(AnalyticsEventProjectionService.class);
    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    private AnalyticsEventMessageHandler handler;

    @BeforeEach
    void setUp() {
        handler = new AnalyticsEventMessageHandler(new ObjectMapper(), projectionService, meterRegistry);
    }

    @Test
    void validBookingEvent_isDelegatedToProjection() {
        String message = paidEvent("booking-service", 1);
        when(projectionService.project(org.mockito.ArgumentMatchers.any())).thenReturn(true);

        handler.consumeBookingEvent(message);

        verify(projectionService).project(org.mockito.ArgumentMatchers.any());
        assertThat(counter("projected")).isEqualTo(1);
    }

    @Test
    void duplicateEvent_isMeasuredWithoutFailure() {
        when(projectionService.project(org.mockito.ArgumentMatchers.any())).thenReturn(false);

        handler.consumeBookingEvent(paidEvent("booking-service", 1));

        assertThat(counter("duplicate")).isEqualTo(1);
    }

    @Test
    void wrongSource_isRejectedBeforeProjection() {
        assertThatThrownBy(() -> handler.consumeBookingEvent(paidEvent("catalog-service", 1)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Unexpected event source");

        verifyNoInteractions(projectionService);
        assertThat(counter("rejected")).isEqualTo(1);
    }

    @Test
    void unknownSchemaVersion_isRejectedBeforeProjection() {
        assertThatThrownBy(() -> handler.consumeBookingEvent(paidEvent("booking-service", 2)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("schema version");

        verifyNoInteractions(projectionService);
    }

    private double counter(String outcome) {
        return meterRegistry.get("cinema.analytics.events").tag("outcome", outcome).counter().count();
    }

    private String paidEvent(String source, int schemaVersion) {
        return """
            {
              "eventId": "550e8400-e29b-41d4-a716-446655440000",
              "eventType": "order.paid",
              "occurredAt": "2026-07-10T12:00:00Z",
              "schemaVersion": %d,
              "source": "%s",
              "payload": {
                "orderId": 1234,
                "userId": 42,
                "showtimeId": 567,
                "finalAmount": 405000.00,
                "ticketCount": 3
              }
            }
            """.formatted(schemaVersion, source);
    }
}
