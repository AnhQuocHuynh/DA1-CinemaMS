package com.uit.cinema.booking.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uit.cinema.booking.entity.ProcessedPaymentEvent;
import com.uit.cinema.booking.repository.ProcessedPaymentEventRepository;
import com.uit.cinema.booking.service.PaymentService;
import com.uit.cinema.core.exception.CustomException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PaymentEventProcessorTest {

    private final ProcessedPaymentEventRepository inbox = mock(ProcessedPaymentEventRepository.class);
    private final PaymentService paymentService = mock(PaymentService.class);
    private PaymentEventProcessor processor;

    @BeforeEach
    void setUp() {
        processor = new PaymentEventProcessor(new PaymentEventEnvelopeReader(new ObjectMapper()), inbox, paymentService);
        when(inbox.saveAndFlush(any(ProcessedPaymentEvent.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(inbox.findById(any(UUID.class))).thenReturn(Optional.of(ProcessedPaymentEvent.builder()
            .eventId(UUID.fromString("550e8400-e29b-41d4-a716-446655440010"))
            .eventType("payment.completed")
            .build()));
    }

    @Test
    void duplicateEventId_skipsDomain() {
        when(inbox.existsById(UUID.fromString("550e8400-e29b-41d4-a716-446655440010"))).thenReturn(true);

        boolean applied = processor.process(completedJson(), "payment.completed");

        assertThat(applied).isFalse();
        verify(paymentService, never()).applyCompletedPayment(any(), any(), any(), any(), any());
    }

    @Test
    void completedEvent_appliesDomain() {
        when(inbox.existsById(any())).thenReturn(false);
        when(paymentService.applyCompletedPayment(any(), any(), any(), any(), any()))
            .thenReturn(PaymentEventOutcome.APPLIED);

        assertThat(processor.process(completedJson(), "payment.completed")).isTrue();
        verify(paymentService).applyCompletedPayment(eq(101L), eq(7L), eq("STRIPE"), eq("txn_1"), any());
    }

    @Test
    void missingOrder_isRetryableAndDoesNotStayClaimed() {
        when(inbox.existsById(any())).thenReturn(false);
        when(paymentService.applyCompletedPayment(any(), any(), any(), any(), any()))
            .thenReturn(PaymentEventOutcome.ORDER_MISSING);

        assertThatThrownBy(() -> processor.process(completedJson(), "payment.completed"))
            .isInstanceOf(PaymentEventRetryableException.class);
    }

    @Test
    void typeMismatch_isPoison() {
        when(inbox.existsById(any())).thenReturn(false);

        assertThatThrownBy(() -> processor.process(completedJson(), "payment.failed"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("does not match queue contract");
        verify(paymentService, never()).applyFailedPayment(any(), any(), any());
    }

    @Test
    void checkedInRefund_isPoison() {
        when(inbox.existsById(any())).thenReturn(false);
        when(paymentService.applyRefundedPayment(any(), any(), any(), any()))
            .thenThrow(new CustomException("Checked-in ticket cannot be refunded", HttpStatus.BAD_REQUEST, "TICKET_ALREADY_CHECKED_IN"));

        assertThatThrownBy(() -> processor.process(refundedJson(), "payment.refunded"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    private String completedJson() {
        return """
            {
              "eventId": "550e8400-e29b-41d4-a716-446655440010",
              "eventType": "payment.completed",
              "occurredAt": "2026-08-20T12:00:00Z",
              "schemaVersion": 1,
              "source": "payment-service",
              "payload": {
                "orderId": 101,
                "userId": 7,
                "amount": 350000.00,
                "transactionId": "txn_1",
                "paymentMethod": "STRIPE"
              }
            }
            """;
    }

    private String refundedJson() {
        return """
            {
              "eventId": "550e8400-e29b-41d4-a716-446655440011",
              "eventType": "payment.refunded",
              "occurredAt": "2026-08-20T13:00:00Z",
              "schemaVersion": 1,
              "source": "payment-service",
              "payload": {
                "orderId": 101,
                "userId": 7,
                "refundAmount": 350000.00,
                "reason": "customer"
              }
            }
            """;
    }
}
