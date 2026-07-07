package com.uit.cinema.showtime.service.contract;

import java.util.List;

/**
 * Result contract after confirming held seats as booked.
 */
public record SeatBookingResult(
    Long showtimeId,
    List<Long> bookedSeatIds,
    int affectedRows,
    List<SeatView> seats
) {
    public SeatBookingResult(Long showtimeId, List<Long> bookedSeatIds, int affectedRows) {
        this(showtimeId, bookedSeatIds, affectedRows, List.of());
    }
}
