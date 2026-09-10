package com.uit.cinema.booking.messaging;

import com.uit.cinema.booking.entity.ProcessedPaymentEvent;
import com.uit.cinema.booking.repository.ProcessedPaymentEventRepository;
import com.uit.cinema.booking.service.PaymentService;
import com.uit.cinema.core.exception.CustomException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class PaymentEventProcessor {

    static final String COMPLETED = "payment.completed";
    static final String FAILED = "payment.failed";
    static final String REFUNDED = "payment.refunded";

    private final PaymentEventEnvelopeReader envelopeReader;
    private final ProcessedPaymentEventRepository processedPaymentEventRepository;
    private final PaymentService paymentService;

    public PaymentEventProcessor(
        PaymentEventEnvelopeReader envelopeReader,
        ProcessedPaymentEventRepository processedPaymentEventRepository,
        PaymentService paymentService
    ) {
        this.envelopeReader = envelopeReader;
        this.processedPaymentEventRepository = processedPaymentEventRepository;
        this.paymentService = paymentService;
    }

    @Transactional
    public boolean process(String message, String expectedEventType) {
        PaymentEventEnvelope envelope = envelopeReader.read(message);
        if (!expectedEventType.equals(envelope.eventType())) {
            throw PaymentEventEnvelopeReader.poison(
                "Event type " + envelope.eventType() + " does not match queue contract " + expectedEventType
            );
        }
        if (processedPaymentEventRepository.existsById(envelope.eventId())) {
            return false;
        }
        try {
            processedPaymentEventRepository.saveAndFlush(ProcessedPaymentEvent.builder()
                .eventId(envelope.eventId())
                .eventType(envelope.eventType())
                .orderId(null)
                .occurredAt(envelope.occurredAt())
                .processedAt(Instant.now())
                .build());
        } catch (DataIntegrityViolationException ignored) {
            return false;
        }

        PaymentEventOutcome outcome = apply(envelope);
        if (outcome == PaymentEventOutcome.ORDER_MISSING) {
            throw new PaymentEventRetryableException(
                "Order not found for " + envelope.eventType() + "; will retry"
            );
        }
        Long orderId = switch (envelope.eventType()) {
            case COMPLETED -> envelopeReader.completedPayload(envelope.payload()).orderId();
            case FAILED -> envelopeReader.failedPayload(envelope.payload()).orderId();
            case REFUNDED -> envelopeReader.refundedPayload(envelope.payload()).orderId();
            default -> throw PaymentEventEnvelopeReader.poison("Unsupported payment event type: " + envelope.eventType());
        };
        processedPaymentEventRepository.findById(envelope.eventId()).ifPresent(row -> {
            row.setOrderId(orderId);
            processedPaymentEventRepository.save(row);
        });
        return outcome == PaymentEventOutcome.APPLIED;
    }

    private PaymentEventOutcome apply(PaymentEventEnvelope envelope) {
        try {
            return switch (envelope.eventType()) {
                case COMPLETED -> {
                    PaymentCompletedPayload payload = envelopeReader.completedPayload(envelope.payload());
                    yield paymentService.applyCompletedPayment(
                        payload.orderId(),
                        payload.userId(),
                        payload.paymentMethod(),
                        payload.transactionId(),
                        payload.amount()
                    );
                }
                case FAILED -> {
                    PaymentFailedPayload payload = envelopeReader.failedPayload(envelope.payload());
                    yield paymentService.applyFailedPayment(payload.orderId(), payload.userId(), payload.reason());
                }
                case REFUNDED -> {
                    PaymentRefundedPayload payload = envelopeReader.refundedPayload(envelope.payload());
                    yield paymentService.applyRefundedPayment(
                        payload.orderId(),
                        payload.userId(),
                        payload.reason(),
                        payload.refundAmount()
                    );
                }
                default -> throw PaymentEventEnvelopeReader.poison("Unsupported payment event type: " + envelope.eventType());
            };
        } catch (CustomException exception) {
            if ("ORDER_NOT_FOUND".equals(exception.getErrorCode())) {
                throw new PaymentEventRetryableException(exception.getMessage(), exception);
            }
            if (exception.getStatus() == HttpStatus.NOT_FOUND || exception.getStatus() == HttpStatus.BAD_GATEWAY
                || exception.getStatus() == HttpStatus.SERVICE_UNAVAILABLE || exception.getStatus() == HttpStatus.GATEWAY_TIMEOUT) {
                throw new PaymentEventRetryableException(exception.getMessage(), exception);
            }
            throw PaymentEventEnvelopeReader.poison(exception.getMessage(), exception);
        }
    }
}
