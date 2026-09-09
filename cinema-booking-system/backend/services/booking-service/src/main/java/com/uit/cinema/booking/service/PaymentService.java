package com.uit.cinema.booking.service;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.messaging.PaymentEventOutcome;

import java.math.BigDecimal;

public interface PaymentService {
    Order processPayment(Long orderId, String paymentMethod, String transactionId);
    Order refund(Long orderId, String reason);

    PaymentEventOutcome applyCompletedPayment(
        Long orderId,
        Long userId,
        String paymentMethod,
        String transactionId,
        BigDecimal amount
    );

    PaymentEventOutcome applyFailedPayment(Long orderId, Long userId, String reason);

    PaymentEventOutcome applyRefundedPayment(
        Long orderId,
        Long userId,
        String reason,
        BigDecimal refundAmount
    );
}
