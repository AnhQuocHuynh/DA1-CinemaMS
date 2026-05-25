package com.uit.cinema.booking.service;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.entity.Voucher;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.VoucherRepository;
import com.uit.cinema.booking.service.Impl.OrderServiceImpl;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.service.SeatReservationService;
import com.uit.cinema.showtime.service.contract.SeatBookingRequest;
import com.uit.cinema.showtime.service.contract.SeatBookingResult;
import com.uit.cinema.showtime.service.contract.SeatHoldValidationResult;
import com.uit.cinema.showtime.service.contract.SeatView;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceImplTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private VoucherRepository voucherRepository;

    @Mock
    private SeatReservationService seatReservationService;

    @Mock
    private TicketGenerationService ticketGenerationService;

    @InjectMocks
    private OrderServiceImpl orderService;

    @Test
    void createOrder_happyPathWithoutVoucher_booksSeatsAndGeneratesTickets() {
        List<SeatView> seats = List.of(
            new SeatView(1L, new BigDecimal("50.00")),
            new SeatView(2L, new BigDecimal("70.00"))
        );

        when(seatReservationService.validateHeldSeats(any(SeatBookingRequest.class)))
            .thenReturn(new SeatHoldValidationResult(seats, new BigDecimal("120.00")));
        when(seatReservationService.confirmHeldSeats(any(SeatBookingRequest.class)))
            .thenReturn(new SeatBookingResult(100L, List.of(1L, 2L), 2));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order saved = invocation.getArgument(0);
            saved.setId(99L);
            return saved;
        });
        when(ticketGenerationService.generateTicket(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order result = orderService.createOrder(10L, 100L, List.of(1L, 2L), null);

        assertEquals(99L, result.getId());
        assertEquals(new BigDecimal("120.00"), result.getTotalAmount());
        assertEquals(new BigDecimal("0"), result.getDiscountAmount());
        assertEquals(new BigDecimal("120.00"), result.getFinalAmount());
        assertNull(result.getVoucherId());

        ArgumentCaptor<SeatBookingRequest> requestCaptor = ArgumentCaptor.forClass(SeatBookingRequest.class);
        verify(seatReservationService).validateHeldSeats(requestCaptor.capture());
        assertEquals(10L, requestCaptor.getValue().userId());
        assertEquals(100L, requestCaptor.getValue().showtimeId());
        assertEquals(List.of(1L, 2L), requestCaptor.getValue().seatIds());

        verify(seatReservationService, times(1)).confirmHeldSeats(any(SeatBookingRequest.class));
        verify(ticketGenerationService, times(2)).generateTicket(any(Ticket.class));
    }

    @Test
    void createOrder_whenSeatNotFound_throwsNotFound() {
        when(seatReservationService.validateHeldSeats(any(SeatBookingRequest.class)))
            .thenThrow(new CustomException("Ghế không tồn tại", HttpStatus.NOT_FOUND, "SEAT_NOT_FOUND"));

        CustomException ex = assertThrows(
            CustomException.class,
            () -> orderService.createOrder(10L, 100L, List.of(1L), null)
        );

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        assertEquals("SEAT_NOT_FOUND", ex.getErrorCode());
    }

    @Test
    void createOrder_whenSeatNotHeld_throwsConflict() {
        when(seatReservationService.validateHeldSeats(any(SeatBookingRequest.class)))
            .thenThrow(new CustomException("Ghế chưa được giữ hoặc đã hết hạn giữ", HttpStatus.CONFLICT, "SEAT_NOT_HELD"));

        CustomException ex = assertThrows(
            CustomException.class,
            () -> orderService.createOrder(10L, 100L, List.of(1L), null)
        );

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("SEAT_NOT_HELD", ex.getErrorCode());
    }

    @Test
    void createOrder_whenVoucherMissing_throwsBadRequest() {
        when(seatReservationService.validateHeldSeats(any(SeatBookingRequest.class)))
            .thenReturn(new SeatHoldValidationResult(List.of(new SeatView(1L, new BigDecimal("100.00"))), new BigDecimal("100.00")));
        when(voucherRepository.findByCodeAndActiveTrue("NOPE")).thenReturn(Optional.empty());

        CustomException ex = assertThrows(
            CustomException.class,
            () -> orderService.createOrder(10L, 100L, List.of(1L), "NOPE")
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("INVALID_VOUCHER", ex.getErrorCode());
        verify(seatReservationService, never()).confirmHeldSeats(any(SeatBookingRequest.class));
    }

    @Test
    void createOrder_whenVoucherExpired_throwsBadRequest() {
        Voucher expired = Voucher.builder()
            .id(5L)
            .code("OLD")
            .discountType(Voucher.DiscountType.FIXED_AMOUNT)
            .discountValue(new BigDecimal("10"))
            .validUntil(LocalDateTime.now().minusDays(1))
            .usedCount(0)
            .build();

        when(seatReservationService.validateHeldSeats(any(SeatBookingRequest.class)))
            .thenReturn(new SeatHoldValidationResult(List.of(new SeatView(1L, new BigDecimal("100.00"))), new BigDecimal("100.00")));
        when(voucherRepository.findByCodeAndActiveTrue("OLD")).thenReturn(Optional.of(expired));

        CustomException ex = assertThrows(
            CustomException.class,
            () -> orderService.createOrder(10L, 100L, List.of(1L), "OLD")
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("VOUCHER_EXPIRED", ex.getErrorCode());
        verify(seatReservationService, never()).confirmHeldSeats(any(SeatBookingRequest.class));
    }

    @Test
    void createOrder_happyPathWithPercentageVoucherAndCap_appliesDiscount() {
        Voucher voucher = Voucher.builder()
            .id(8L)
            .code("SAVE20")
            .discountType(Voucher.DiscountType.PERCENTAGE)
            .discountValue(new BigDecimal("20"))
            .maxDiscountAmount(new BigDecimal("30.00"))
            .usageLimit(10)
            .usedCount(0)
            .validUntil(LocalDateTime.now().plusDays(1))
            .build();

        when(seatReservationService.validateHeldSeats(any(SeatBookingRequest.class)))
            .thenReturn(new SeatHoldValidationResult(
                List.of(new SeatView(1L, new BigDecimal("100.00")), new SeatView(2L, new BigDecimal("100.00"))),
                new BigDecimal("200.00")
            ));
        when(seatReservationService.confirmHeldSeats(any(SeatBookingRequest.class)))
            .thenReturn(new SeatBookingResult(100L, List.of(1L, 2L), 2));
        when(voucherRepository.findByCodeAndActiveTrue("SAVE20")).thenReturn(Optional.of(voucher));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(ticketGenerationService.generateTicket(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order result = orderService.createOrder(10L, 100L, List.of(1L, 2L), "SAVE20");

        assertEquals(new BigDecimal("200.00"), result.getTotalAmount());
        assertEquals(new BigDecimal("30.00"), result.getDiscountAmount());
        assertEquals(new BigDecimal("170.00"), result.getFinalAmount());
        assertEquals(8L, result.getVoucherId());
        assertEquals(1, voucher.getUsedCount());

        ArgumentCaptor<Order> orderCaptor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository).save(orderCaptor.capture());
        assertEquals(new BigDecimal("170.00"), orderCaptor.getValue().getFinalAmount());
        verify(seatReservationService, times(1)).confirmHeldSeats(any(SeatBookingRequest.class));
    }
}
