package com.uit.cinema.staff.service;

import com.uit.cinema.booking.dto.response.OrderResponse;
import com.uit.cinema.staff.dto.request.StaffCounterBookingRequest;

public interface StaffBookingService {
    OrderResponse createCounterBooking(StaffCounterBookingRequest request, Long staffId);
}
