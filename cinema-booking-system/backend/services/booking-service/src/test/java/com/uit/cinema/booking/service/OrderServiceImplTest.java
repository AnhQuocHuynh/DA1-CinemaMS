package com.uit.cinema.booking.service;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Voucher;
import com.uit.cinema.booking.outbox.BookingOutboxEventWriter;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.VoucherRepository;
import com.uit.cinema.booking.service.Impl.OrderServiceImpl;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.core.exception.DuplicatePendingOrderException;
import com.uit.cinema.showtime.service.SeatReservationService;
import com.uit.cinema.showtime.service.contract.SeatBookingRequest;
import com.uit.cinema.showtime.service.contract.SeatHoldValidationResult;
import com.uit.cinema.showtime.service.contract.SeatView;
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
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
    private BookingOutboxEventWriter bookingOutboxEventWriter;

    @InjectMocks
    private OrderServiceImpl orderService;

    @Test
    void createOrder_happyPathWithoutVoucher_createsPendingOrder() {
        when(seatReservationService.validateHeldSeats(any()))
            .thenReturn(new SeatHoldValidationResult(List.of(new SeatView(1L, new BigDecimal("120.00"))), new BigDecimal("120.00")));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order saved = invocation.getArgument(0);
            saved.setId(99L);
            return saved;
        });

        Order result = orderService.createOrder(10L, 100L, List.of(1L), null);

        assertEquals(99L, result.getId());
        assertEquals(new BigDecimal("120.00"), result.getTotalAmount());
        assertEquals(BigDecimal.ZERO, result.getDiscountAmount());
        assertEquals(new BigDecimal("120.00"), result.getFinalAmount());
        assertEquals(Order.OrderStatus.PENDING, result.getStatus());
        assertEquals("1", result.getSeatIdsSnapshot());
        assertNull(result.getVoucherId());
        verify(seatReservationService).validateHeldSeats(any());
        verify(orderRepository).save(any(Order.class));
        verify(bookingOutboxEventWriter).orderCreated(any(Order.class));
    }

    @Test
    void createOrder_whenDuplicatePendingOrder_throwsDuplicatePendingOrderException() {
        Order existing = Order.builder().id(777L).seatIdsSnapshot("1").build();
        when(orderRepository.findByUserIdAndShowtimeIdAndStatus(10L, 100L, Order.OrderStatus.PENDING))
            .thenReturn(Optional.of(existing));

        DuplicatePendingOrderException ex = assertThrows(
            DuplicatePendingOrderException.class,
            () -> orderService.createOrder(10L, 100L, List.of(1L), null)
        );

        assertEquals(777L, ex.getExistingOrderId());
        assertEquals("DUPLICATE_PENDING_ORDER", ex.getErrorCode());
        verifyNoInteractions(seatReservationService);
    }

    @Test
    void createOrder_whenPendingOrderHasSameSeatsInDifferentOrder_throwsDuplicatePendingOrderException() {
        Order existing = Order.builder().id(777L).userId(10L).showtimeId(100L).seatIdsSnapshot("2,1").build();
        when(orderRepository.findByUserIdAndShowtimeIdAndStatus(10L, 100L, Order.OrderStatus.PENDING))
            .thenReturn(Optional.of(existing));

        DuplicatePendingOrderException ex = assertThrows(
            DuplicatePendingOrderException.class,
            () -> orderService.createOrder(10L, 100L, List.of(1L, 2L), null)
        );

        assertEquals(777L, ex.getExistingOrderId());
        assertEquals(Order.OrderStatus.PENDING, existing.getStatus());
        verifyNoInteractions(seatReservationService);
        verify(orderRepository, never()).save(any(Order.class));
    }

    @Test
    void createOrder_whenPendingOrderHasDifferentSeats_cancelsOldOrderAndCreatesNewOrder() {
        Order stale = pendingOrder(777L, "1,2", null);
        SeatBookingRequest newSeats = new SeatBookingRequest(10L, 100L, List.of(2L, 3L));
        SeatBookingRequest releasedSeat = new SeatBookingRequest(10L, 100L, List.of(1L));
        when(orderRepository.findByUserIdAndShowtimeIdAndStatus(10L, 100L, Order.OrderStatus.PENDING))
            .thenReturn(Optional.of(stale));
        when(seatReservationService.validateHeldSeats(newSeats)).thenReturn(heldSeats("240.00"));
        when(seatReservationService.validateHeldSeats(releasedSeat)).thenReturn(heldSeats("120.00"));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order saved = invocation.getArgument(0);
            if (saved.getId() == null) {
                saved.setId(888L);
            }
            return saved;
        });

        Order result = orderService.createOrder(10L, 100L, List.of(2L, 3L), null);

        assertEquals(888L, result.getId());
        assertEquals(Order.OrderStatus.PENDING, result.getStatus());
        assertEquals("2,3", result.getSeatIdsSnapshot());
        assertEquals(new BigDecimal("240.00"), result.getFinalAmount());
        assertEquals(Order.OrderStatus.CANCELLED, stale.getStatus());
        verify(bookingOutboxEventWriter).orderCancelled(777L, 10L, "SEATS_CHANGED");
        verify(bookingOutboxEventWriter).orderCreated(result);
        // Seat 1 is dropped from the selection and still held by this user -> released.
        verify(seatReservationService).releaseHeldSeats(releasedSeat);
        // Seat 2 is part of the new selection -> its hold must be preserved.
        verify(seatReservationService, never()).releaseHeldSeats(new SeatBookingRequest(10L, 100L, List.of(2L)));
    }

    @Test
    void createOrder_whenNewSeatsAreNotHeld_keepsOldPendingOrderUntouched() {
        Order stale = pendingOrder(777L, "1,2", null);
        when(orderRepository.findByUserIdAndShowtimeIdAndStatus(10L, 100L, Order.OrderStatus.PENDING))
            .thenReturn(Optional.of(stale));
        when(seatReservationService.validateHeldSeats(any()))
            .thenThrow(new CustomException("Seat is not in HELD status", HttpStatus.CONFLICT, "SEAT_NOT_HELD"));

        CustomException ex = assertThrows(
            CustomException.class,
            () -> orderService.createOrder(10L, 100L, List.of(3L), null)
        );

        assertEquals("SEAT_NOT_HELD", ex.getErrorCode());
        assertEquals(Order.OrderStatus.PENDING, stale.getStatus());
        verify(orderRepository, never()).save(any(Order.class));
        verifyNoInteractions(bookingOutboxEventWriter);
        verify(seatReservationService, never()).releaseHeldSeats(any());
    }

    @Test
    void createOrder_whenDroppedSeatNoLongerHeldByUser_skipsReleaseButStillCreatesOrder() {
        Order stale = pendingOrder(777L, "1,2", null);
        SeatBookingRequest newSeats = new SeatBookingRequest(10L, 100L, List.of(2L, 3L));
        SeatBookingRequest droppedSeat = new SeatBookingRequest(10L, 100L, List.of(1L));
        when(orderRepository.findByUserIdAndShowtimeIdAndStatus(10L, 100L, Order.OrderStatus.PENDING))
            .thenReturn(Optional.of(stale));
        when(seatReservationService.validateHeldSeats(newSeats)).thenReturn(heldSeats("240.00"));
        when(seatReservationService.validateHeldSeats(droppedSeat))
            .thenThrow(new CustomException("Seat hold is invalid or expired", HttpStatus.CONFLICT, "SEAT_HOLD_INVALID"));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order result = orderService.createOrder(10L, 100L, List.of(2L, 3L), null);

        assertEquals(Order.OrderStatus.PENDING, result.getStatus());
        assertEquals(Order.OrderStatus.CANCELLED, stale.getStatus());
        verify(seatReservationService, never()).releaseHeldSeats(any());
    }

    @Test
    void createOrder_whenSupersededOrderUsedVoucher_restoresVoucherUsage() {
        Order stale = pendingOrder(777L, "1", 8L);
        Voucher voucher = Voucher.builder().id(8L).code("SAVE20").usedCount(1).build();
        when(orderRepository.findByUserIdAndShowtimeIdAndStatus(10L, 100L, Order.OrderStatus.PENDING))
            .thenReturn(Optional.of(stale));
        when(seatReservationService.validateHeldSeats(any())).thenReturn(heldSeats("120.00"));
        when(voucherRepository.findById(8L)).thenReturn(Optional.of(voucher));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        orderService.createOrder(10L, 100L, List.of(5L), null);

        assertEquals(0, voucher.getUsedCount());
        assertEquals(Order.OrderStatus.CANCELLED, stale.getStatus());
    }

    private Order pendingOrder(Long id, String seatSnapshot, Long voucherId) {
        return Order.builder()
            .id(id)
            .userId(10L)
            .showtimeId(100L)
            .seatIdsSnapshot(seatSnapshot)
            .voucherId(voucherId)
            .status(Order.OrderStatus.PENDING)
            .build();
    }

    private SeatHoldValidationResult heldSeats(String total) {
        return new SeatHoldValidationResult(List.of(new SeatView(1L, new BigDecimal(total))), new BigDecimal(total));
    }

    @Test
    void createOrder_whenSeatListEmpty_throwsBadRequest() {
        CustomException ex = assertThrows(
            CustomException.class,
            () -> orderService.createOrder(10L, 100L, List.of(), null)
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("SEAT_LIST_EMPTY", ex.getErrorCode());
        verifyNoInteractions(seatReservationService);
    }

    @Test
    void createOrder_whenSeatNotHeld_throwsConflict() {
        when(seatReservationService.validateHeldSeats(any()))
            .thenThrow(new CustomException("Seat is not in HELD status", HttpStatus.CONFLICT, "SEAT_NOT_HELD"));

        CustomException ex = assertThrows(
            CustomException.class,
            () -> orderService.createOrder(10L, 100L, List.of(1L), null)
        );

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("SEAT_NOT_HELD", ex.getErrorCode());
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

        when(seatReservationService.validateHeldSeats(any()))
            .thenReturn(new SeatHoldValidationResult(List.of(new SeatView(1L, new BigDecimal("200.00"))), new BigDecimal("200.00")));
        when(voucherRepository.findByCodeAndActiveTrue("SAVE20")).thenReturn(Optional.of(voucher));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order result = orderService.createOrder(10L, 100L, List.of(1L), "SAVE20");

        assertEquals(new BigDecimal("200.00"), result.getTotalAmount());
        assertEquals(new BigDecimal("30.00"), result.getDiscountAmount());
        assertEquals(new BigDecimal("170.00"), result.getFinalAmount());
        assertEquals(8L, result.getVoucherId());
        assertEquals(1, voucher.getUsedCount());
        verify(bookingOutboxEventWriter).orderCreated(any(Order.class));
    }
}
