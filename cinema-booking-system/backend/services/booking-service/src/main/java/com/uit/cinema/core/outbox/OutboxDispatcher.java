package com.uit.cinema.core.outbox;

import lombok.extern.slf4j.Slf4j;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.core.MessagePostProcessor;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.Duration;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Opt-in relay for transactional-outbox rows. Consumer idempotency handles a
 * possible duplicate when a process fails after RabbitMQ accepts a message.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "outbox.dispatcher.enabled", havingValue = "true")
public class OutboxDispatcher {

    private final OutboxEventRepository outboxEventRepository;
    private final RabbitTemplate rabbitTemplate;
    private final int batchSize;
    private final Duration confirmTimeout;
    private final Counter publishedCounter;
    private final Counter retryCounter;
    private final Counter terminalFailureCounter;

    public OutboxDispatcher(
        OutboxEventRepository outboxEventRepository,
        RabbitTemplate rabbitTemplate,
        @Value("${outbox.dispatcher.batch-size:50}") int batchSize,
        @Value("${outbox.dispatcher.confirm-timeout:5s}") Duration confirmTimeout,
        MeterRegistry meterRegistry
    ) {
        this.outboxEventRepository = outboxEventRepository;
        this.rabbitTemplate = rabbitTemplate;
        this.batchSize = Math.max(1, Math.min(batchSize, 500));
        this.confirmTimeout = confirmTimeout.isNegative() || confirmTimeout.isZero()
            ? Duration.ofSeconds(5)
            : confirmTimeout;
        this.publishedCounter = meterRegistry.counter("cinema.outbox.events", "outcome", "published");
        this.retryCounter = meterRegistry.counter("cinema.outbox.events", "outcome", "retry");
        this.terminalFailureCounter = meterRegistry.counter("cinema.outbox.events", "outcome", "failed");
    }

    @Scheduled(fixedDelayString = "${outbox.dispatcher.fixed-delay-ms:5000}")
    @Transactional
    public void dispatchPending() {
        Instant now = Instant.now();
        outboxEventRepository.findPendingForDispatch(
            OutboxEvent.OutboxStatus.PENDING,
            now,
            PageRequest.of(0, batchSize)
        ).forEach(event -> dispatch(event, now));
    }

    private void dispatch(OutboxEvent event, Instant now) {
        try {
            publishAndAwaitConfirm(event);
            event.markPublished(now);
            publishedCounter.increment();
        } catch (RuntimeException exception) {
            event.recordFailure(now, exception.getMessage());
            if (event.getStatus() == OutboxEvent.OutboxStatus.FAILED) {
                terminalFailureCounter.increment();
            } else {
                retryCounter.increment();
            }
            log.warn(
                "Outbox event {} publish attempt {} failed: {}",
                event.getEventId(),
                event.getAttemptCount(),
                exception.toString()
            );
        }
    }

    private void publishAndAwaitConfirm(OutboxEvent event) {
        CorrelationData correlationData = new CorrelationData(event.getEventId().toString());
        rabbitTemplate.convertAndSend(
            event.getExchangeName(),
            event.getRoutingKey(),
            event.getPayload(),
            headers(event),
            correlationData
        );

        try {
            CorrelationData.Confirm confirm = correlationData.getFuture()
                .get(confirmTimeout.toMillis(), TimeUnit.MILLISECONDS);
            if (!confirm.isAck()) {
                throw new AmqpException("Broker negatively acknowledged event: " + confirm.getReason());
            }
            if (correlationData.getReturned() != null) {
                throw new AmqpException(
                    "Broker returned unroutable event: " + correlationData.getReturned().getReplyText()
                );
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AmqpException("Interrupted while waiting for broker confirmation", exception);
        } catch (ExecutionException | TimeoutException exception) {
            throw new AmqpException("Broker confirmation was not received", exception);
        }
    }

    private MessagePostProcessor headers(OutboxEvent event) {
        return message -> {
            message.getMessageProperties().setMessageId(event.getEventId().toString());
            message.getMessageProperties().setHeader("eventType", event.getEventType());
            message.getMessageProperties().setHeader("schemaVersion", event.getSchemaVersion());
            return message;
        };
    }
}
