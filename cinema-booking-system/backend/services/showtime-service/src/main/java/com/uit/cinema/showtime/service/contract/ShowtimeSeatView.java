package com.uit.cinema.showtime.service.contract;

import java.math.BigDecimal;

/**
 * Lightweight showtime-seat projection for booking/ticket read models.
 */
public record ShowtimeSeatView(
    Long seatId,
    Long showtimeId,
    Long seatTemplateId,
    BigDecimal price,
    String status
) {
}
