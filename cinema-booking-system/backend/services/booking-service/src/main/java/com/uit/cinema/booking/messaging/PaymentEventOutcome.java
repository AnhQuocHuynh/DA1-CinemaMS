package com.uit.cinema.booking.messaging;

public enum PaymentEventOutcome {
    APPLIED,
    ALREADY_APPLIED,
    IGNORED_STALE,
    ORDER_MISSING
}
