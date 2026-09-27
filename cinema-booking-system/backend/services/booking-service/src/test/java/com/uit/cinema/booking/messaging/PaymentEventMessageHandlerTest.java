package com.uit.cinema.booking.messaging;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PaymentEventMessageHandlerTest {

    private final PaymentEventProcessor processor = mock(PaymentEventProcessor.class);
    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    private PaymentEventMessageHandler handler;

    @BeforeEach
    void setUp() {
        handler = new PaymentEventMessageHandler(processor, meterRegistry);
    }

    @Test
    void appliedEvent_isMeasured() {
        when(processor.process("{msg}", "payment.completed")).thenReturn(true);

        handler.consumeCompleted("{msg}");

        verify(processor).process("{msg}", "payment.completed");
        assertThat(counter("applied")).isEqualTo(1);
    }

    @Test
    void duplicateEvent_isMeasuredWithoutFailure() {
        when(processor.process("{msg}", "payment.failed")).thenReturn(false);

        handler.consumeFailed("{msg}");

        assertThat(counter("duplicate")).isEqualTo(1);
    }

    @Test
    void poisonMessage_isRejectedAndRethrown() {
        when(processor.process("{bad}", "payment.refunded"))
            .thenThrow(new IllegalArgumentException("Event envelope is not valid JSON"));

        assertThatThrownBy(() -> handler.consumeRefunded("{bad}"))
            .isInstanceOf(IllegalArgumentException.class);

        assertThat(counter("rejected")).isEqualTo(1);
    }

    private double counter(String outcome) {
        return meterRegistry.get("cinema.booking.payment.events").tag("outcome", outcome).counter().count();
    }
}
