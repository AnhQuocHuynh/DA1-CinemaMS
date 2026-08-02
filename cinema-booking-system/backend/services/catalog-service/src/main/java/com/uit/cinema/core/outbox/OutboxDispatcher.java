package com.uit.cinema.core.outbox;

import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.MessagePostProcessor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

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

    public OutboxDispatcher(
        OutboxEventRepository outboxEventRepository,
        RabbitTemplate rabbitTemplate,
        @Value("${outbox.dispatcher.batch-size:50}") int batchSize
    ) {
        this.outboxEventRepository = outboxEventRepository;
        this.rabbitTemplate = rabbitTemplate;
        this.batchSize = Math.max(1, Math.min(batchSize, 500));
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
            rabbitTemplate.convertAndSend(
                event.getExchangeName(),
                event.getRoutingKey(),
                event.getPayload(),
                headers(event)
            );
            event.markPublished(now);
        } catch (RuntimeException exception) {
            event.recordFailure(now, exception.getMessage());
            log.warn(
                "Outbox event {} publish attempt {} failed: {}",
                event.getEventId(),
                event.getAttemptCount(),
                exception.toString()
            );
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
