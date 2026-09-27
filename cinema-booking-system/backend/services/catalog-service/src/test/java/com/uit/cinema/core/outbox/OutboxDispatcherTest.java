package com.uit.cinema.core.outbox;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.core.MessagePostProcessor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OutboxDispatcherTest {

    @Mock
    private OutboxEventRepository outboxEventRepository;

    @Mock
    private RabbitTemplate rabbitTemplate;

    @Test
    void dispatchPending_marksEventPublishedAfterBrokerAcceptsMessage() {
        OutboxEvent event = pendingEvent();
        when(outboxEventRepository.findPendingForDispatch(eq(OutboxEvent.OutboxStatus.PENDING), any(), any(Pageable.class)))
            .thenReturn(List.of(event));
        SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
        confirmWith(true, null);
        OutboxDispatcher dispatcher = new OutboxDispatcher(
            outboxEventRepository, rabbitTemplate, 50, Duration.ofSeconds(1), meterRegistry
        );

        dispatcher.dispatchPending();

        ArgumentCaptor<MessagePostProcessor> headers = ArgumentCaptor.forClass(MessagePostProcessor.class);
        verify(rabbitTemplate).convertAndSend(
            eq("catalog.events"),
            eq("movie.created"),
            eq("{}"),
            headers.capture(),
            any(CorrelationData.class)
        );
        assertEquals(OutboxEvent.OutboxStatus.PUBLISHED, event.getStatus());
        assertNotNull(event.getPublishedAt());
        assertEquals(1.0, meterRegistry.get("cinema.outbox.events").tag("outcome", "published").counter().count());
    }

    @Test
    void dispatchPending_reschedulesFailureWithoutDroppingEvent() {
        OutboxEvent event = pendingEvent();
        when(outboxEventRepository.findPendingForDispatch(eq(OutboxEvent.OutboxStatus.PENDING), any(), any(Pageable.class)))
            .thenReturn(List.of(event));
        doThrow(new AmqpException("broker unavailable"))
            .when(rabbitTemplate)
            .convertAndSend(
                any(String.class),
                any(String.class),
                any(),
                any(MessagePostProcessor.class),
                any(CorrelationData.class)
            );
        OutboxDispatcher dispatcher = new OutboxDispatcher(
            outboxEventRepository, rabbitTemplate, 50, Duration.ofSeconds(1), new SimpleMeterRegistry()
        );

        dispatcher.dispatchPending();

        assertEquals(OutboxEvent.OutboxStatus.PENDING, event.getStatus());
        assertEquals(1, event.getAttemptCount());
        assertNotNull(event.getNextAttemptAt());
    }

    @Test
    void dispatchPending_reschedulesNegativeBrokerConfirmation() {
        OutboxEvent event = pendingEvent();
        when(outboxEventRepository.findPendingForDispatch(eq(OutboxEvent.OutboxStatus.PENDING), any(), any(Pageable.class)))
            .thenReturn(List.of(event));
        confirmWith(false, "exchange unavailable");
        OutboxDispatcher dispatcher = new OutboxDispatcher(
            outboxEventRepository, rabbitTemplate, 50, Duration.ofSeconds(1), new SimpleMeterRegistry()
        );

        dispatcher.dispatchPending();

        assertEquals(OutboxEvent.OutboxStatus.PENDING, event.getStatus());
        assertEquals(1, event.getAttemptCount());
    }

    private void confirmWith(boolean ack, String reason) {
        doAnswer(invocation -> {
            CorrelationData correlationData = invocation.getArgument(4);
            correlationData.getFuture().complete(new CorrelationData.Confirm(ack, reason));
            return null;
        }).when(rabbitTemplate).convertAndSend(
            any(String.class),
            any(String.class),
            any(),
            any(MessagePostProcessor.class),
            any(CorrelationData.class)
        );
    }

    private OutboxEvent pendingEvent() {
        Instant now = Instant.now();
        return OutboxEvent.builder()
            .eventId(UUID.randomUUID())
            .eventType("movie.created")
            .exchangeName("catalog.events")
            .routingKey("movie.created")
            .aggregateType("movie")
            .aggregateId(15L)
            .schemaVersion(1)
            .occurredAt(now)
            .payload("{}")
            .nextAttemptAt(now)
            .build();
    }
}
