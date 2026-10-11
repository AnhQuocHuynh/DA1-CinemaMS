package com.uit.cinema.booking.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffDashboardSummaryResponse {
    private long todayBookings;
    private long totalTicketsSold;
    private String peakHour;
}
