package com.uit.cinema.booking.messaging;

import java.util.UUID;

public record PaymentExpiredPayload(
    UUID correlationId,
    Long paymentId,
    Long orderId,
    Long userId,
    String reason
) {
}
