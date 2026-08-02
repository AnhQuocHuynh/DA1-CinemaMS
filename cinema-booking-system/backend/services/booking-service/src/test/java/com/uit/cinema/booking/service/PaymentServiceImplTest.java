package com.uit.cinema.booking.service;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.outbox.BookingOutboxEventWriter;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.booking.service.Impl.PaymentServiceImpl;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.service.SeatReservationService;
import com.uit.cinema.showtime.service.contract.SeatBookingResult;
import com.uit.cinema.showtime.service.contract.SeatReleaseRequest;
import com.uit.cinema.showtime.service.contract.SeatView;
import com.uit.cinema.showtime.service.contract.ShowtimeScheduleView;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
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
    void processPayment_happyPath_marksOrderPaidAndBooksSeat() {
        Order order = buildOrder(1L, Order.OrderStatus.PENDING);
        ShowtimeScheduleView showtime = scheduleInHours(2);

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));
        when(orderRepository.findByPaymentTransactionId("TXN-1")).thenReturn(Optional.empty());
        when(seatReservationService.confirmHeldSeats(any()))
            .thenReturn(new SeatBookingResult(100L, List.of(55L), 1, List.of(new SeatView(55L, new BigDecimal("100.00")))));
        when(seatReservationService.getSchedule(100L)).thenReturn(showtime);
        when(ticketGenerationService.generateTicket(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order result = paymentService.processPayment(1L, "VNPAY", "TXN-1");

        assertEquals(Order.OrderStatus.PAID, result.getStatus());
        assertEquals("VNPAY", result.getPaymentMethod());
        assertEquals("TXN-1", result.getPaymentTransactionId());
        verify(seatReservationService).confirmHeldSeats(any());
        verify(ticketGenerationService).generateTicket(any(Ticket.class));
        verify(bookingOutboxEventWriter).orderPaid(order, showtime, 1);
    }

    @Test
    void processPayment_whenOrderNotFound_throwsNotFound() {
        when(orderRepository.findById(1L)).thenReturn(Optional.empty());

        CustomException ex = assertThrows(
            CustomException.class,
            () -> paymentService.processPayment(1L, "VNPAY", "TXN-1")
        );

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        assertEquals("ORDER_NOT_FOUND", ex.getErrorCode());
    }

    @Test
    void processPayment_whenOrderNotPending_throwsBadRequest() {
        Order order = buildOrder(1L, Order.OrderStatus.PAID);
        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));
        when(orderRepository.findByPaymentTransactionId("TXN-1")).thenReturn(Optional.empty());

        CustomException ex = assertThrows(
            CustomException.class,
            () -> paymentService.processPayment(1L, "VNPAY", "TXN-1")
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("INVALID_ORDER_STATUS", ex.getErrorCode());
    }

    @Test
    void refund_happyPath_marksOrderRefunded() {
        Order order = buildOrder(1L, Order.OrderStatus.PAID);
        Ticket ticket = Ticket.builder()
            .id(9L)
            .order(order)
            .showtimeSeatId(55L)
            .status(Ticket.TicketStatus.VALID)
            .price(BigDecimal.TEN)
            .build();

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));
        when(seatReservationService.getSchedule(100L)).thenReturn(scheduleInHours(30));
        when(ticketRepository.findByOrderIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(ticket));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order result = paymentService.refund(1L, "user request");

        assertEquals(Order.OrderStatus.REFUNDED, result.getStatus());
        assertEquals(Ticket.TicketStatus.REFUNDED, ticket.getStatus());
        verify(seatReservationService).releaseBookedSeats(any(SeatReleaseRequest.class));
        verify(bookingOutboxEventWriter).orderRefunded(order, 1);
    }

    @Test
    void refund_whenOrderNotPaid_throwsBadRequest() {
        Order order = buildOrder(1L, Order.OrderStatus.PENDING);
        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));

        CustomException ex = assertThrows(
            CustomException.class,
            () -> paymentService.refund(1L, "user request")
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("INVALID_ORDER_STATUS", ex.getErrorCode());
    }

    @Test
    void refund_when4To24Hours_refunds50Percent() {
        Order order = buildOrder(1L, Order.OrderStatus.PAID);
        Ticket ticket = Ticket.builder()
            .id(9L)
            .order(order)
            .showtimeSeatId(55L)
            .status(Ticket.TicketStatus.VALID)
            .price(BigDecimal.TEN)
            .build();

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));
        when(seatReservationService.getSchedule(100L)).thenReturn(scheduleInHours(10));
        when(ticketRepository.findByOrderIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(ticket));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order result = paymentService.refund(1L, "user request");

        assertEquals(Order.OrderStatus.REFUNDED, result.getStatus());
        assertEquals(Ticket.TicketStatus.REFUNDED, ticket.getStatus());
    }

    @Test
    void refund_whenLessThan4Hours_throwsException() {
        Order order = buildOrder(1L, Order.OrderStatus.PAID);

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));
        when(seatReservationService.getSchedule(100L)).thenReturn(scheduleInHours(2));

        CustomException ex = assertThrows(
            CustomException.class,
            () -> paymentService.refund(1L, "user request")
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("REFUND_WINDOW_CLOSED", ex.getErrorCode());
    }

    private ShowtimeScheduleView scheduleInHours(long hours) {
        return new ShowtimeScheduleView(
            100L,
            1L,
            null,
            2L,
            LocalDateTime.now().plusHours(hours),
            LocalDateTime.now().plusHours(hours + 2),
            "SCHEDULED"
        );
    }

    private Order buildOrder(Long id, Order.OrderStatus status) {
        return Order.builder()
            .id(id)
            .userId(10L)
            .showtimeId(100L)
            .seatIdsSnapshot("55")
            .totalAmount(new BigDecimal("100.00"))
            .discountAmount(BigDecimal.ZERO)
            .finalAmount(new BigDecimal("100.00"))
            .status(status)
            .build();
    }
}
