package com.uit.cinema.showtime.service.contract;

import java.time.LocalDateTime;

/**
 * Lightweight showtime projection for booking-side policy checks.
 */
public record ShowtimeScheduleView(
    Long showtimeId,
    Long movieId,
    Long eventId,
    Long roomId,
    LocalDateTime startTime,
    LocalDateTime endTime,
    String status
) {
}
