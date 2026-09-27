package com.uit.cinema.showtime.service.contract;

import java.math.BigDecimal;

/**
 * Lightweight seat projection returned to booking module.
 * Keeps booking logic decoupled from mutable showtime entities.
 */
public record SeatView(
    Long seatId,
    BigDecimal price
) {
}
