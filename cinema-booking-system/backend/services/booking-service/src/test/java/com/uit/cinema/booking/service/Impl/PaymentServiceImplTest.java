package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.outbox.BookingOutboxEventWriter;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.booking.service.TicketGenerationService;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.service.SeatReservationService;
import com.uit.cinema.showtime.service.contract.ShowtimeScheduleView;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentServiceImplTest {

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private TicketRepository ticketRepository;
    @Mock
    private TicketGenerationService ticketGenerationService;
    @Mock
    private SeatReservationService seatReservationService;
    @Mock
    private BookingOutboxEventWriter bookingOutboxEventWriter;

    @InjectMocks
    private PaymentServiceImpl paymentService;

    @Test
    void processPayment_shouldReturnExistingPaidOrder_whenSameTransactionId() {
        Order pendingOrder = Order.builder()
            .id(10L)
            .userId(1L)
            .showtimeId(2L)
            .seatIdsSnapshot("1,2")
            .totalAmount(BigDecimal.TEN)
            .finalAmount(BigDecimal.TEN)
            .status(Order.OrderStatus.PENDING)
            .build();

        Order existingPaid = Order.builder()
            .id(10L)
            .status(Order.OrderStatus.PAID)
            .paymentTransactionId("TXN-1")
            .build();

        when(orderRepository.findById(10L)).thenReturn(Optional.of(pendingOrder));
        when(orderRepository.findByPaymentTransactionId("TXN-1")).thenReturn(Optional.of(existingPaid));

        Order result = paymentService.processPayment(10L, "MOCK", "TXN-1");
        assertEquals(Order.OrderStatus.PAID, result.getStatus());
        assertEquals(10L, result.getId());
    }

    @Test
    void refund_shouldThrowWhenRefundWindowClosed() {
        Order paidOrder = Order.builder()
            .id(20L)
            .showtimeId(3L)
            .status(Order.OrderStatus.PAID)
            .build();
        ShowtimeScheduleView showtime = new ShowtimeScheduleView(
            3L,
            1L,
            null,
            2L,
            LocalDateTime.now().plusHours(2),
            LocalDateTime.now().plusHours(4),
            "SCHEDULED"
        );

        when(orderRepository.findById(20L)).thenReturn(Optional.of(paidOrder));
        when(seatReservationService.getSchedule(3L)).thenReturn(showtime);

        CustomException ex = assertThrows(CustomException.class, () -> paymentService.refund(20L, "User request"));
        assertEquals("REFUND_WINDOW_CLOSED", ex.getErrorCode());
    }
}
