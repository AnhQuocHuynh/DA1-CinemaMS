package com.uit.cinema.booking.service;

import com.uit.cinema.booking.dto.response.TicketResponse;

import java.util.List;

public interface TicketService {
    TicketResponse checkIn(String ticketCode);
    TicketResponse getByCode(String ticketCode);
    List<TicketResponse> getByUserId(Long userId);
    List<TicketResponse> getByOrderId(Long orderId);
}
