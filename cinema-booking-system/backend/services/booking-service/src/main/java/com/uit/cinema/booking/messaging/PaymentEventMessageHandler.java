package com.uit.cinema.booking.messaging;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "booking.messaging.payment-events.enabled", havingValue = "true")
public class PaymentEventMessageHandler {

    private final PaymentEventProcessor paymentEventProcessor;
    private final Counter appliedCounter;
    private final Counter duplicateCounter;
    private final Counter rejectedCounter;

    public PaymentEventMessageHandler(
        PaymentEventProcessor paymentEventProcessor,
        MeterRegistry meterRegistry
    ) {
        this.paymentEventProcessor = paymentEventProcessor;
        this.appliedCounter = meterRegistry.counter("cinema.booking.payment.events", "outcome", "applied");
        this.duplicateCounter = meterRegistry.counter("cinema.booking.payment.events", "outcome", "duplicate");
        this.rejectedCounter = meterRegistry.counter("cinema.booking.payment.events", "outcome", "rejected");
    }

    @RabbitListener(queues = "${booking.messaging.payment-events.completed-queue:booking.payment.completed.v1}")
    public void consumeCompleted(String message) {
        consume(message, PaymentEventProcessor.COMPLETED);
    }

    @RabbitListener(queues = "${booking.messaging.payment-events.failed-queue:booking.payment.failed.v1}")
    public void consumeFailed(String message) {
        consume(message, PaymentEventProcessor.FAILED);
    }

    @RabbitListener(queues = "${booking.messaging.payment-events.refunded-queue:booking.payment.refunded.v1}")
    public void consumeRefunded(String message) {
        consume(message, PaymentEventProcessor.REFUNDED);
    }

    void consume(String message, String expectedEventType) {
        try {
            if (paymentEventProcessor.process(message, expectedEventType)) {
                appliedCounter.increment();
            } else {
                duplicateCounter.increment();
            }
        } catch (IllegalArgumentException exception) {
            rejectedCounter.increment();
            throw exception;
        }
    }
}
