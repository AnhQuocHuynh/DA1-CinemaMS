package com.uit.cinema.analytics.readmodel;

import java.math.BigDecimal;

public record DashboardMetric(
    BigDecimal totalRevenue,
    long totalBookings,
    long seatsSold,
    long seatsAvailable,
    long activeUsers,
    long totalMovies
) {

    public static DashboardMetric empty() {
        return new DashboardMetric(BigDecimal.ZERO, 0, 0, 0, 0, 0);
    }
}
