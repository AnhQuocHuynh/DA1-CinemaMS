package com.uit.cinema.booking.messaging;

import java.math.BigDecimal;
import java.util.UUID;

public record PaymentRefundedPayload(
    UUID correlationId,
    Long paymentId,
    Long orderId,
    Long userId,
    BigDecimal refundAmount,
    String reason
) {
}
