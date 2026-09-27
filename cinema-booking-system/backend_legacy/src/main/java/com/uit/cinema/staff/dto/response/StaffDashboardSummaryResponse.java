package com.uit.cinema.staff.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class StaffDashboardSummaryResponse {
    private long todayBookings;
    private long totalTicketsSold;
    private String peakHour;
}
