package com.uit.cinema.booking.service;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.booking.service.Impl.PaymentServiceImpl;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.entity.Showtime;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.repository.ShowtimeRepository;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import com.uit.cinema.showtime.service.SeatHoldPolicy;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
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
    private ShowtimeSeatRepository showtimeSeatRepository;
    @Mock
    private ShowtimeRepository showtimeRepository;
    @Mock
    private TicketRepository ticketRepository;
    @Mock
    private TicketGenerationService ticketGenerationService;
    @Mock
    private RedisTemplate<String, Object> redisTemplate;
    @Mock
    private ValueOperations<String, Object> valueOperations;

    @InjectMocks
    private PaymentServiceImpl paymentService;

    @Test
    void processPayment_happyPath_marksOrderPaidAndBooksSeat() {
        Order order = buildOrder(1L, Order.OrderStatus.PENDING);
        ShowtimeSeat seat = ShowtimeSeat.builder()
            .id(55L)
            .showtimeId(100L)
            .price(new BigDecimal("100.00"))
            .status(ShowtimeSeat.SeatStatus.HELD)
            .build();

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));
        when(orderRepository.findByPaymentTransactionId("TXN-1")).thenReturn(Optional.empty());
        when(showtimeSeatRepository.findById(55L)).thenReturn(Optional.of(seat));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(SeatHoldPolicy.holdKey(100L, 55L))).thenReturn("10");
        when(ticketGenerationService.generateTicket(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order result = paymentService.processPayment(1L, "VNPAY", "TXN-1");

        assertEquals(Order.OrderStatus.PAID, result.getStatus());
        assertEquals("VNPAY", result.getPaymentMethod());
        assertEquals("TXN-1", result.getPaymentTransactionId());
        assertEquals(ShowtimeSeat.SeatStatus.BOOKED, seat.getStatus());
        verify(showtimeSeatRepository).save(seat);
        verify(redisTemplate).delete(SeatHoldPolicy.holdKey(100L, 55L));
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
        Showtime showtime = Showtime.builder()
            .id(100L)
            .startTime(LocalDateTime.now().plusHours(30))
            .endTime(LocalDateTime.now().plusHours(32))
            .build();
        Ticket ticket = Ticket.builder()
            .id(9L)
            .order(order)
            .showtimeSeatId(55L)
            .status(Ticket.TicketStatus.VALID)
            .price(BigDecimal.TEN)
            .build();
        ShowtimeSeat seat = ShowtimeSeat.builder().id(55L).status(ShowtimeSeat.SeatStatus.BOOKED).build();

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));
        when(showtimeRepository.findById(100L)).thenReturn(Optional.of(showtime));
        when(ticketRepository.findByOrderIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(ticket));
        when(showtimeSeatRepository.findById(55L)).thenReturn(Optional.of(seat));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order result = paymentService.refund(1L, "user request");

        assertEquals(Order.OrderStatus.REFUNDED, result.getStatus());
        assertEquals(Ticket.TicketStatus.REFUNDED, ticket.getStatus());
        assertEquals(ShowtimeSeat.SeatStatus.AVAILABLE, seat.getStatus());
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
        Showtime showtime = Showtime.builder()
            .id(100L)
            .startTime(LocalDateTime.now().plusHours(10)) // Between 4 and 24 hours
            .endTime(LocalDateTime.now().plusHours(12))
            .build();
        Ticket ticket = Ticket.builder()
            .id(9L)
            .order(order)
            .showtimeSeatId(55L)
            .status(Ticket.TicketStatus.VALID)
            .price(BigDecimal.TEN)
            .build();
        ShowtimeSeat seat = ShowtimeSeat.builder().id(55L).status(ShowtimeSeat.SeatStatus.BOOKED).build();

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));
        when(showtimeRepository.findById(100L)).thenReturn(Optional.of(showtime));
        when(ticketRepository.findByOrderIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(ticket));
        when(showtimeSeatRepository.findById(55L)).thenReturn(Optional.of(seat));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order result = paymentService.refund(1L, "user request");

        assertEquals(Order.OrderStatus.REFUNDED, result.getStatus());
        assertEquals(Ticket.TicketStatus.REFUNDED, ticket.getStatus());
        assertEquals(ShowtimeSeat.SeatStatus.AVAILABLE, seat.getStatus());
    }

    @Test
    void refund_whenLessThan4Hours_throwsException() {
        Order order = buildOrder(1L, Order.OrderStatus.PAID);
        Showtime showtime = Showtime.builder()
            .id(100L)
            .startTime(LocalDateTime.now().plusHours(2)) // Less than 4 hours
            .endTime(LocalDateTime.now().plusHours(4))
            .build();

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));
        when(showtimeRepository.findById(100L)).thenReturn(Optional.of(showtime));

        CustomException ex = assertThrows(
            CustomException.class,
            () -> paymentService.refund(1L, "user request")
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("REFUND_WINDOW_CLOSED", ex.getErrorCode());
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
