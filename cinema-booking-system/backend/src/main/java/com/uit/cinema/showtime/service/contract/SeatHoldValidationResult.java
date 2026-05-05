package com.uit.cinema.showtime.service.contract;

import java.math.BigDecimal;
import java.util.List;

/**
 * Result contract for seat validation before order persistence.
 *
 * TODO:
 * - Return normalized seat list for deterministic downstream processing.
 * - Compute and return total amount from seat prices.
 */
public record SeatHoldValidationResult(
    List<SeatView> seats,
    BigDecimal totalAmount
) {
}
