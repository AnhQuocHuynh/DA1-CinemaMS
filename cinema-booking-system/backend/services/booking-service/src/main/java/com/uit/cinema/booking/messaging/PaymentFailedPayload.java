package com.uit.cinema.booking.messaging;

import java.util.UUID;

public record PaymentFailedPayload(
    UUID correlationId,
    Long paymentId,
    Long orderId,
    Long userId,
    String reason
) {
}
