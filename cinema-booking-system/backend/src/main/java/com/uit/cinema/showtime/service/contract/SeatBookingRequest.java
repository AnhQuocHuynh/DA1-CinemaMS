package com.uit.cinema.showtime.service.contract;

import java.util.List;

/**
 * Input contract for booking -> showtime seat confirmation flow.
 *
 * TODO:
 * - Add validation annotations if needed.
 * - Keep fields minimal and stable to reduce coupling.
 */
public record SeatBookingRequest(
    Long userId,
    Long showtimeId,
    List<Long> seatIds
) {
}
