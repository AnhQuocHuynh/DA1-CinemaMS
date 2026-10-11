package com.uit.cinema.booking.controller;

import com.uit.cinema.booking.dto.request.StaffCounterBookingRequest;
import com.uit.cinema.booking.dto.response.OrderResponse;
import com.uit.cinema.booking.dto.response.StaffBookingListItemResponse;
import com.uit.cinema.booking.dto.response.StaffBookingValidationResponse;
import com.uit.cinema.booking.dto.response.StaffDashboardSummaryResponse;
import com.uit.cinema.booking.dto.response.StaffValidationStatsResponse;
import com.uit.cinema.booking.security.AuthenticatedUserIdResolver;
import com.uit.cinema.booking.service.StaffBookingService;
import com.uit.cinema.core.dto.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
public class StaffBookingController {

    private final StaffBookingService staffBookingService;
    private final AuthenticatedUserIdResolver userIdResolver;

    @PostMapping("/bookings")
    public ResponseEntity<ApiResponse<OrderResponse>> createCounterBooking(
            @Valid @RequestBody StaffCounterBookingRequest request
    ) {
        Long staffId = resolveCurrentStaffId();
        OrderResponse result = staffBookingService.createCounterBooking(request, staffId);
        return ResponseEntity.ok(ApiResponse.success(result, "Counter booking created successfully"));
    }

    @GetMapping("/dashboard/summary")
    public ResponseEntity<ApiResponse<StaffDashboardSummaryResponse>> getDashboardSummary() {
        return ResponseEntity.ok(ApiResponse.success(staffBookingService.getStaffDashboardSummary()));
    }

    @GetMapping("/dashboard/bookings/today")
    public ResponseEntity<ApiResponse<List<StaffBookingListItemResponse>>> getTodayBookings(
            @RequestParam(defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(ApiResponse.success(staffBookingService.getTodayBookings(limit)));
    }

    @GetMapping("/dashboard/validation/stats")
    public ResponseEntity<ApiResponse<StaffValidationStatsResponse>> getValidationStats() {
        return ResponseEntity.ok(ApiResponse.success(staffBookingService.getValidationStats()));
    }

    @GetMapping("/dashboard/validation/bookings")
    public ResponseEntity<ApiResponse<List<StaffBookingValidationResponse>>> getValidationBookings(
            @RequestParam(defaultValue = "20") int limit
    ) {
        return ResponseEntity.ok(ApiResponse.success(staffBookingService.getValidationBookings(limit)));
    }

    private Long resolveCurrentStaffId() {
        try {
            return userIdResolver.currentUserId();
        } catch (Exception e) {
            log.warn("Could not resolve current staff ID from token/header, defaulting to 1: {}", e.getMessage());
            return 1L;
        }
    }
}
