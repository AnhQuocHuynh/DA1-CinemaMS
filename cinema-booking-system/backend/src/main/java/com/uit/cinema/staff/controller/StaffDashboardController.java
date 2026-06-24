package com.uit.cinema.staff.controller;

import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.staff.dto.response.StaffBookingResponse;
import com.uit.cinema.staff.dto.response.StaffDashboardSummaryResponse;
import com.uit.cinema.staff.dto.response.StaffValidationStatsResponse;
import com.uit.cinema.staff.service.StaffDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/staff/dashboard")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
public class StaffDashboardController {

    private final StaffDashboardService staffDashboardService;

    @GetMapping("/summary")
    public ApiResponse<StaffDashboardSummaryResponse> getSummary() {
        return ApiResponse.success(staffDashboardService.getSummary());
    }

    @GetMapping("/bookings/today")
    public ApiResponse<List<StaffBookingResponse>> getTodayBookings(
            @RequestParam(defaultValue = "10") int limit) {
        return ApiResponse.success(staffDashboardService.getTodayBookings(limit));
    }

    @GetMapping("/validation/stats")
    public ApiResponse<StaffValidationStatsResponse> getValidationStats() {
        return ApiResponse.success(staffDashboardService.getValidationStats());
    }

    @GetMapping("/validation/bookings")
    public ApiResponse<List<StaffBookingResponse>> getValidationBookings(
            @RequestParam(defaultValue = "20") int limit) {
        return ApiResponse.success(staffDashboardService.getValidationBookings(limit));
    }
}
