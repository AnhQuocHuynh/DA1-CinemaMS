package com.uit.cinema.booking.service;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.service.Impl.PaymentServiceImpl;
import com.uit.cinema.core.exception.CustomException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
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

    @InjectMocks
    private PaymentServiceImpl paymentService;

    @Test
    void processPayment_happyPath_marksOrderPaid() {
        Order order = buildOrder(1L, Order.OrderStatus.PENDING);
        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order result = paymentService.processPayment(1L, "VNPAY", "TXN-1");

        assertEquals(Order.OrderStatus.PAID, result.getStatus());
        assertEquals("VNPAY", result.getPaymentMethod());
        assertEquals("TXN-1", result.getPaymentTransactionId());
        verify(orderRepository).save(order);
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
        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order result = paymentService.refund(1L, "user request");

        assertEquals(Order.OrderStatus.REFUNDED, result.getStatus());
        verify(orderRepository).save(order);
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

    private Order buildOrder(Long id, Order.OrderStatus status) {
        return Order.builder()
            .id(id)
            .userId(10L)
            .totalAmount(new BigDecimal("100.00"))
            .discountAmount(new BigDecimal("0"))
            .finalAmount(new BigDecimal("100.00"))
            .status(status)
            .build();
    }
}
