package com.uit.cinema.showtime.service.contract;

import java.math.BigDecimal;

/**
 * Lightweight seat projection returned to booking module.
 *
 * TODO:
 * - Add only the properties required by order pricing and ticket creation.
 * - Avoid exposing internal mutable entity state.
 */
public record SeatView(
    Long seatId,
    BigDecimal price
) {
}
