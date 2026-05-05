package com.uit.cinema.showtime.service.contract;

import java.util.List;

/**
 * Result contract after confirming held seats as booked.
 *
 * TODO:
 * - Keep enough metadata for logging/audit and order traceability.
 * - Include updated seat ids for ticket generation linkage.
 */
public record SeatBookingResult(
    Long showtimeId,
    List<Long> bookedSeatIds,
    int affectedRows
) {
}
