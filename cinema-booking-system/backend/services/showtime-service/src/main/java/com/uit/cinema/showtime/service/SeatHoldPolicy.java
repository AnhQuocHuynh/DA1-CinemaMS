package com.uit.cinema.showtime.service;

import com.uit.cinema.showtime.entity.ShowtimeSeat;

import java.time.Duration;
import java.time.Instant;

/**
 * Frozen policy for seat hold key format and TTL across showtime/booking flows.
 * Redis is the fast lock. The seat row records the holder and expiry so a
 * database row lock can take over when Redis is unavailable.
 */
public final class SeatHoldPolicy {

    private SeatHoldPolicy() {
    }

    public static final Duration HOLD_TTL = Duration.ofMinutes(10);

    public static String holdKey(Long showtimeId, Long seatId) {
        return "seat:hold:" + showtimeId + ":" + seatId;
    }

    public static boolean blocksNewHolder(ShowtimeSeat seat, Long userId, Instant now) {
        if (seat.getStatus() != ShowtimeSeat.SeatStatus.HELD) {
            return false;
        }
        Long holder = seat.getHeldByUserId();
        Instant expiresAt = seat.getHoldExpiresAt();
        if (holder == null || expiresAt == null || !expiresAt.isAfter(now)) {
            return false;
        }
        return !holder.equals(userId);
    }

    public static boolean ownedActiveHold(ShowtimeSeat seat, Long userId, Instant now) {
        if (seat == null || userId == null || seat.getStatus() != ShowtimeSeat.SeatStatus.HELD) {
            return false;
        }
        return userId.equals(seat.getHeldByUserId())
            && seat.getHoldExpiresAt() != null
            && seat.getHoldExpiresAt().isAfter(now);
    }
}
