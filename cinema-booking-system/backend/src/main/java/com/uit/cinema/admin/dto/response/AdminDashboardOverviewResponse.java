package com.uit.cinema.admin.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class AdminDashboardOverviewResponse {
    private BigDecimal totalRevenue;
    private String revenueChange;
    private Integer occupancyRate;
    private Long seatsSold;
    private Long seatsAvailable;
    private Long totalBookings;
    private Long activeUsers;
    private Long totalMovies;
}
