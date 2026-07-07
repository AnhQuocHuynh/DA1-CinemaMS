package com.uit.cinema.showtime.service.contract;

import java.util.List;

/**
 * Input contract for booking -> showtime seat confirmation flow.
 */
public record SeatBookingRequest(
    Long userId,
    Long showtimeId,
    List<Long> seatIds
) {
}
