package com.uit.cinema.showtime.service;

import java.time.Duration;

/**
 * Frozen policy for seat hold key format and TTL across showtime/booking flows.
 */
public final class SeatHoldPolicy {

    private SeatHoldPolicy() {
    }

    public static final Duration HOLD_TTL = Duration.ofMinutes(10);

    public static String holdKey(Long showtimeId, Long seatId) {
        return "seat:hold:" + showtimeId + ":" + seatId;
    }
}
