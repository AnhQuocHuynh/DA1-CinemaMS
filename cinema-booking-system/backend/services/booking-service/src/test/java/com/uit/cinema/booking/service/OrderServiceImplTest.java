package com.uit.cinema.booking.service;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Voucher;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.VoucherRepository;
import com.uit.cinema.booking.service.Impl.OrderServiceImpl;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.service.SeatReservationService;
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
    }
}
