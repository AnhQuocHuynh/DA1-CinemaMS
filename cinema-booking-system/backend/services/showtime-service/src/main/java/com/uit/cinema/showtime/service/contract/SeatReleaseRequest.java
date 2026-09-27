package com.uit.cinema.showtime.service.contract;

import java.util.List;

/**
 * Input contract for releasing seats after cancellation or refund.
 */
public record SeatReleaseRequest(
    Long showtimeId,
    List<Long> seatIds
) {
}
