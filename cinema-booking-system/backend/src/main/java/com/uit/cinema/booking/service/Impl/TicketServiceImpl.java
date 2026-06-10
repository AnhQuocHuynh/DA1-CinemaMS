package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.dto.response.TicketResponse;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.mapper.TicketMapper;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.booking.service.TicketGenerationService;
import com.uit.cinema.booking.service.TicketService;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.service.ShowtimeService;
import com.uit.cinema.showtime.dto.response.ShowtimeSeatResponse;
import com.uit.cinema.showtime.dto.response.ShowtimeResponse;
import com.uit.cinema.catalog.service.MovieService;
import com.uit.cinema.catalog.dto.response.MovieResponse;
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
    private final ShowtimeService showtimeService;
    private final MovieService movieService;

    @Override
    @Transactional
    public TicketResponse checkIn(String ticketCode) {
        TicketResponse response = ticketMapper.toResponse(ticketGenerationService.checkIn(ticketCode));
        enrichTicketInfo(response);
        return response;
    }

    @Override
    public TicketResponse getByCode(String ticketCode) {
        Ticket ticket = ticketRepository.findByTicketCode(ticketCode)
            .orElseThrow(() -> new CustomException("Ticket not found", HttpStatus.NOT_FOUND, "TICKET_NOT_FOUND"));
        TicketResponse response = ticketMapper.toResponse(ticket);
        enrichTicketInfo(response);
        return response;
    }

    @Override
    public List<TicketResponse> getByUserId(Long userId) {
        List<TicketResponse> responses = ticketRepository.findByOrderUserIdOrderByCreatedAtDesc(userId)
            .stream().map(ticketMapper::toResponse).toList();
        responses.forEach(this::enrichTicketInfo);
        return responses;
    }

    @Override
    public List<TicketResponse> getByOrderId(Long orderId) {
        List<TicketResponse> responses = ticketRepository.findByOrderIdOrderByCreatedAtDesc(orderId)
            .stream().map(ticketMapper::toResponse).toList();
        responses.forEach(this::enrichTicketInfo);
        return responses;
    }

    private void enrichTicketInfo(TicketResponse response) {
        try {
            ShowtimeSeatResponse seat = showtimeService.getSeatById(response.getShowtimeSeatId());
            ShowtimeResponse showtime = showtimeService.getShowtimeById(seat.getShowtimeId());
            MovieResponse movie = movieService.getMovieById(showtime.getMovieId());

            response.setMovieName(movie.getTitle());
            response.setShowtimeDateTime(showtime.getStartTime());
            response.setCinemaName(showtime.getCinemaName());
            response.setHallName(showtime.getRoomName());

            if (response.getStatus() != Ticket.TicketStatus.VALID) {
                response.setRefundable(false);
                response.setRefundPercent(0);
                return;
            }

            int refundPercent = calculateRefundPercent(showtime.getStartTime(), LocalDateTime.now());
            response.setRefundPercent(refundPercent);
            response.setRefundable(refundPercent > 0);
        } catch (Exception e) {
            if (response.getStatus() != Ticket.TicketStatus.VALID) {
                response.setRefundable(false);
                response.setRefundPercent(0);
            }
        }
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
