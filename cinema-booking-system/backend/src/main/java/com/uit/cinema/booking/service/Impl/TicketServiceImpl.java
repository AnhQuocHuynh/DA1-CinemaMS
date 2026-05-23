package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.dto.response.TicketResponse;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.mapper.TicketMapper;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.booking.service.TicketGenerationService;
import com.uit.cinema.booking.service.TicketService;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.entity.Showtime;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.repository.ShowtimeRepository;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TicketServiceImpl implements TicketService {

    private final TicketRepository ticketRepository;
    private final TicketGenerationService ticketGenerationService;
    private final TicketMapper ticketMapper;
    private final ShowtimeSeatRepository showtimeSeatRepository;
    private final ShowtimeRepository showtimeRepository;

    @Override
    @Transactional
    public TicketResponse checkIn(String ticketCode) {
        TicketResponse response = ticketMapper.toResponse(ticketGenerationService.checkIn(ticketCode));
        enrichRefundInfo(response);
        return response;
    }

    @Override
    public TicketResponse getByCode(String ticketCode) {
        Ticket ticket = ticketRepository.findByTicketCode(ticketCode)
            .orElseThrow(() -> new CustomException("Ticket not found", HttpStatus.NOT_FOUND, "TICKET_NOT_FOUND"));
        TicketResponse response = ticketMapper.toResponse(ticket);
        enrichRefundInfo(response);
        return response;
    }

    @Override
    public List<TicketResponse> getByUserId(Long userId) {
        List<TicketResponse> responses = ticketRepository.findByOrderUserIdOrderByCreatedAtDesc(userId)
            .stream().map(ticketMapper::toResponse).toList();
        responses.forEach(this::enrichRefundInfo);
        return responses;
    }

    @Override
    public List<TicketResponse> getByOrderId(Long orderId) {
        List<TicketResponse> responses = ticketRepository.findByOrderIdOrderByCreatedAtDesc(orderId)
            .stream().map(ticketMapper::toResponse).toList();
        responses.forEach(this::enrichRefundInfo);
        return responses;
    }

    private void enrichRefundInfo(TicketResponse response) {
        if (response.getStatus() != Ticket.TicketStatus.VALID) {
            response.setRefundable(false);
            response.setRefundPercent(0);
            return;
        }

        ShowtimeSeat seat = showtimeSeatRepository.findById(response.getShowtimeSeatId())
            .orElse(null);
        if (seat == null) {
            response.setRefundable(false);
            response.setRefundPercent(0);
            return;
        }

        Showtime showtime = showtimeRepository.findById(seat.getShowtimeId()).orElse(null);
        if (showtime == null) {
            response.setRefundable(false);
            response.setRefundPercent(0);
            return;
        }

        int refundPercent = calculateRefundPercent(showtime.getStartTime(), LocalDateTime.now());
        response.setRefundPercent(refundPercent);
        response.setRefundable(refundPercent > 0);
    }

    private int calculateRefundPercent(LocalDateTime showtimeStart, LocalDateTime now) {
        long hoursToShowtime = Duration.between(now, showtimeStart).toHours();
        if (hoursToShowtime > 24) {
            return 100;
        }
        if (hoursToShowtime >= 4) {
            return 50;
        }
        return 0;
    }
}
