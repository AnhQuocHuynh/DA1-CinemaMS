package com.uit.cinema.booking.service;

import com.uit.cinema.booking.dto.request.StaffCounterBookingRequest;
import com.uit.cinema.booking.dto.response.OrderResponse;
import com.uit.cinema.booking.dto.response.StaffBookingListItemResponse;
import com.uit.cinema.booking.dto.response.StaffBookingValidationResponse;
import com.uit.cinema.booking.dto.response.StaffDashboardSummaryResponse;
import com.uit.cinema.booking.dto.response.StaffValidationStatsResponse;

import java.util.List;

public interface StaffBookingService {
    OrderResponse createCounterBooking(StaffCounterBookingRequest request, Long staffId);
    StaffDashboardSummaryResponse getStaffDashboardSummary();
    List<StaffBookingListItemResponse> getTodayBookings(int limit);
    StaffValidationStatsResponse getValidationStats();
    List<StaffBookingValidationResponse> getValidationBookings(int limit);
}
