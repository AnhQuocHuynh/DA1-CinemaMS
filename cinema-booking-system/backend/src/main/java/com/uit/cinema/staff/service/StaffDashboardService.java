package com.uit.cinema.staff.service;

import com.uit.cinema.staff.dto.response.StaffBookingResponse;
import com.uit.cinema.staff.dto.response.StaffDashboardSummaryResponse;
import com.uit.cinema.staff.dto.response.StaffValidationStatsResponse;

import java.util.List;

public interface StaffDashboardService {
    StaffDashboardSummaryResponse getSummary();

    List<StaffBookingResponse> getTodayBookings(int limit);

    StaffValidationStatsResponse getValidationStats();

    List<StaffBookingResponse> getValidationBookings(int limit);
}
