package com.uit.cinema.showtime.service.contract;

import java.util.List;

/**
 * Result contract after confirming held seats as booked.
 */
public record SeatBookingResult(
    Long showtimeId,
    List<Long> bookedSeatIds,
    int affectedRows
) {
}
