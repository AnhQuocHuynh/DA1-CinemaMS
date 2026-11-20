package com.uit.cinema.booking.outbox;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.core.outbox.OutboxEvent;
import com.uit.cinema.core.outbox.OutboxEventRepository;
import com.uit.cinema.core.outbox.TransactionalOutbox;
import com.uit.cinema.showtime.service.contract.ShowtimeScheduleView;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class BookingOutboxEventWriterTest {

    @Mock
    private OutboxEventRepository outboxEventRepository;

    @Captor
    private ArgumentCaptor<OutboxEvent> eventCaptor;

    private ObjectMapper objectMapper;
    private BookingOutboxEventWriter writer;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper().findAndRegisterModules();
        TransactionalOutbox transactionalOutbox = new TransactionalOutbox(outboxEventRepository, objectMapper);
        writer = new BookingOutboxEventWriter(transactionalOutbox);
    }

    @Test
    void orderCancelled_whenSeatsUnavailableAfterPayment_persistsEnvelopeMatchingPaymentServiceContract() throws Exception {
        writer.orderCancelled(101L, 42L, "SEATS_UNAVAILABLE_AFTER_PAYMENT");

        verify(outboxEventRepository).save(eventCaptor.capture());
        OutboxEvent event = eventCaptor.getValue();
        JsonNode envelope = objectMapper.readTree(event.getPayload());
        JsonNode payload = envelope.get("payload");

        assertNotNull(event.getEventId());
        assertEquals(OutboxEvent.OutboxStatus.PENDING, event.getStatus());
        assertEquals("booking.events", event.getExchangeName());
        assertEquals("order.cancelled", event.getRoutingKey());
        assertEquals("order", event.getAggregateType());
        assertEquals(101L, event.getAggregateId());

        assertEquals("order.cancelled", envelope.get("eventType").asText());
        assertEquals("booking-service", envelope.get("source").asText());
        assertEquals(1, envelope.get("schemaVersion").asInt());

        assertEquals(101L, payload.get("orderId").asLong());
        assertEquals(42L, payload.get("userId").asLong());
        assertEquals("SEATS_UNAVAILABLE_AFTER_PAYMENT", payload.get("reason").asText());
    }

    @Test
    void orderCancelled_whenAnonymousUserAndNullReason_serializesGracefully() throws Exception {
        writer.orderCancelled(202L, 0L, null);

        verify(outboxEventRepository).save(eventCaptor.capture());
        OutboxEvent event = eventCaptor.getValue();
        JsonNode payload = objectMapper.readTree(event.getPayload()).get("payload");

        assertEquals(202L, payload.get("orderId").asLong());
        assertEquals(0L, payload.get("userId").asLong());
        assertTrue(payload.get("reason").isNull());
    }

    @Test
    void orderCreated_persistsExpectedOrderCreatedEnvelope() throws Exception {
        Order order = Order.builder()
            .id(303L)
            .userId(15L)
            .totalAmount(new BigDecimal("200000.00"))
            .discountAmount(new BigDecimal("20000.00"))
            .finalAmount(new BigDecimal("180000.00"))
            .build();

        writer.orderCreated(order);

        verify(outboxEventRepository).save(eventCaptor.capture());
        OutboxEvent event = eventCaptor.getValue();
        JsonNode payload = objectMapper.readTree(event.getPayload()).get("payload");

        assertEquals("booking.events", event.getExchangeName());
        assertEquals("order.created", event.getRoutingKey());
        assertEquals(303L, payload.get("orderId").asLong());
        assertEquals(15L, payload.get("userId").asLong());
        assertEquals(0, new BigDecimal("180000.00").compareTo(payload.get("finalAmount").decimalValue()));
    }

    @Test
    void orderPaid_persistsExpectedOrderPaidEnvelope() throws Exception {
        Order order = Order.builder()
            .id(404L)
            .userId(15L)
            .showtimeId(99L)
            .totalAmount(new BigDecimal("180000.00"))
            .finalAmount(new BigDecimal("180000.00"))
            .paymentMethod("STRIPE")
            .paymentTransactionId("pi_123")
            .build();
        ShowtimeScheduleView showtime = new ShowtimeScheduleView(
            99L, 10L, null, 2L, LocalDateTime.now().plusHours(3), LocalDateTime.now().plusHours(5), "SCHEDULED"
        );

        writer.orderPaid(order, showtime, 2);

        verify(outboxEventRepository).save(eventCaptor.capture());
        OutboxEvent event = eventCaptor.getValue();
        JsonNode payload = objectMapper.readTree(event.getPayload()).get("payload");

        assertEquals("order.paid", event.getRoutingKey());
        assertEquals(404L, payload.get("orderId").asLong());
        assertEquals(2, payload.get("ticketCount").asInt());
        assertEquals("STRIPE", payload.get("paymentMethod").asText());
        assertEquals("pi_123", payload.get("transactionId").asText());
    }

    @Test
    void orderRefunded_persistsExpectedOrderRefundedEnvelope() throws Exception {
        Order order = Order.builder()
            .id(505L)
            .userId(15L)
            .showtimeId(99L)
            .finalAmount(new BigDecimal("180000.00"))
            .build();

        writer.orderRefunded(order, 2);

        verify(outboxEventRepository).save(eventCaptor.capture());
        OutboxEvent event = eventCaptor.getValue();
        JsonNode payload = objectMapper.readTree(event.getPayload()).get("payload");

        assertEquals("order.refunded", event.getRoutingKey());
        assertEquals(505L, payload.get("orderId").asLong());
        assertEquals(2, payload.get("ticketCount").asInt());
    }

    @Test
    void orderCancelled_whenRepositoryThrows_propagatesException() {
        doThrow(new RuntimeException("DB connection lost"))
            .when(outboxEventRepository).save(any(OutboxEvent.class));

        assertThrows(
            RuntimeException.class,
            () -> writer.orderCancelled(101L, 42L, "SEATS_UNAVAILABLE_AFTER_PAYMENT")
        );
    }
}

