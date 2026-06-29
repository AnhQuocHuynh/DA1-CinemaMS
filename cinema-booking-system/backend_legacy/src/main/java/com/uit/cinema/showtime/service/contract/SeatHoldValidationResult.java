package com.uit.cinema.showtime.service.contract;

import java.math.BigDecimal;
import java.util.List;

/**
 * Result contract for seat validation before order persistence.
 */
public record SeatHoldValidationResult(
    List<SeatView> seats,
    BigDecimal totalAmount
) {
}
