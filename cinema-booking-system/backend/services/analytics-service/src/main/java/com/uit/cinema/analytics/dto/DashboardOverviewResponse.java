package com.uit.cinema.analytics.dto;

import java.math.BigDecimal;

public record DashboardOverviewResponse(
    BigDecimal totalRevenue,
    String revenueChange,
    int occupancyRate,
    long seatsSold,
    long seatsAvailable,
    long totalBookings,
    long activeUsers,
    long totalMovies
) {
}
