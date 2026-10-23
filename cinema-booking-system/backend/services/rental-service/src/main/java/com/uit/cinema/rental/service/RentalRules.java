package com.uit.cinema.rental.service;

import java.math.BigDecimal;

public record RentalRules(
    int turnoverMinutes,
    int customerCancelHours,
    BigDecimal defaultPricePerHour,
    BigDecimal weekendMultiplier,
    BigDecimal peakMultiplier,
    int peakStartHour,
    int peakEndHour
) {
    public static RentalRules neutral() {
        return new RentalRules(15, 24, new BigDecimal("150000.00"), BigDecimal.ONE, BigDecimal.ONE, 18, 22);
    }
}
