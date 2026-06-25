package com.uit.cinema.staff.controller;

import com.uit.cinema.booking.dto.response.OrderResponse;
import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.core.security.CustomUserDetails;
import com.uit.cinema.staff.dto.request.StaffCounterBookingRequest;
import com.uit.cinema.staff.service.StaffBookingService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/staff/bookings")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
public class StaffBookingController {

    private final StaffBookingService staffBookingService;

    @PostMapping
    public ApiResponse<OrderResponse> createCounterBooking(
            @RequestBody StaffCounterBookingRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        Long staffId = userDetails != null ? userDetails.getUser().getId() : null;
        return ApiResponse.success(staffBookingService.createCounterBooking(request, staffId));
    }
}
