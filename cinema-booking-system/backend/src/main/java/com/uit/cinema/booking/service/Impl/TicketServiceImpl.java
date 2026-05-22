package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.dto.response.TicketResponse;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.mapper.TicketMapper;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.booking.service.TicketGenerationService;
import com.uit.cinema.booking.service.TicketService;
import com.uit.cinema.core.exception.CustomException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TicketServiceImpl implements TicketService {

    private final TicketRepository ticketRepository;
    private final TicketGenerationService ticketGenerationService;
    private final TicketMapper ticketMapper;

    @Override
    @Transactional
    public TicketResponse checkIn(String ticketCode) {
        return ticketMapper.toResponse(ticketGenerationService.checkIn(ticketCode));
    }

    @Override
    public TicketResponse getByCode(String ticketCode) {
        Ticket ticket = ticketRepository.findByTicketCode(ticketCode)
            .orElseThrow(() -> new CustomException("Ticket not found", HttpStatus.NOT_FOUND, "TICKET_NOT_FOUND"));
        return ticketMapper.toResponse(ticket);
    }

    @Override
    public List<TicketResponse> getByUserId(Long userId) {
        return ticketRepository.findByOrderUserIdOrderByCreatedAtDesc(userId)
            .stream().map(ticketMapper::toResponse).toList();
    }

    @Override
    public List<TicketResponse> getByOrderId(Long orderId) {
        return ticketRepository.findByOrderIdOrderByCreatedAtDesc(orderId)
            .stream().map(ticketMapper::toResponse).toList();
    }
}
