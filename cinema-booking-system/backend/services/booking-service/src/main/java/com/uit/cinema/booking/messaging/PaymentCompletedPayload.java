package com.uit.cinema.booking.messaging;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PaymentCompletedPayload(
    UUID correlationId,
    Long paymentId,
    Long orderId,
    Long userId,
    BigDecimal amount,
    String transactionId,
    String paymentMethod,
    Instant paidAt
) {
}
