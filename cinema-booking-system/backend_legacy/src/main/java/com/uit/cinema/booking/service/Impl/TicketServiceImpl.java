package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.dto.response.TicketResponse;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.mapper.TicketMapper;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.booking.service.TicketGenerationService;
import com.uit.cinema.booking.service.TicketService;
import com.uit.cinema.catalog.entity.Event;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.repository.EventRepository;
import com.uit.cinema.catalog.repository.MovieRepository;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.facility.entity.Cinema;
import com.uit.cinema.facility.entity.Room;
import com.uit.cinema.facility.entity.SeatTemplate;
import com.uit.cinema.facility.entity.SeatType;
import com.uit.cinema.facility.repository.RoomRepository;
import com.uit.cinema.facility.repository.SeatTemplateRepository;
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
    private final SeatTemplateRepository seatTemplateRepository;
    private final MovieRepository movieRepository;
    private final EventRepository eventRepository;
    private final RoomRepository roomRepository;

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

        enrichShowtimeInfo(response, seat, showtime);
        if (response.getStatus() != Ticket.TicketStatus.VALID) {
            response.setRefundable(false);
            response.setRefundPercent(0);
            return;
        }

        int refundPercent = calculateRefundPercent(showtime.getStartTime(), LocalDateTime.now());
        response.setRefundPercent(refundPercent);
        response.setRefundable(refundPercent > 0);
    }

    private void enrichShowtimeInfo(TicketResponse response, ShowtimeSeat seat, Showtime showtime) {
        response.setShowtimeId(showtime.getId());
        response.setMovieId(showtime.getMovieId());
        response.setEventId(showtime.getEventId());
        response.setRoomId(showtime.getRoomId());
        response.setStartTime(showtime.getStartTime());
        response.setEndTime(showtime.getEndTime());

        if (showtime.getMovieId() != null) {
            movieRepository.findById(showtime.getMovieId())
                .map(Movie::getTitle)
                .ifPresent(title -> {
                    response.setMovieTitle(title);
                    response.setDisplayTitle(title);
                    response.setDisplayType("MOVIE");
                });
        }
        if (response.getDisplayTitle() == null && showtime.getEventId() != null) {
            eventRepository.findById(showtime.getEventId())
                .map(Event::getName)
                .ifPresent(title -> {
                    response.setEventTitle(title);
                    response.setDisplayTitle(title);
                    response.setDisplayType("EVENT");
                });
        }
        if (response.getDisplayTitle() == null) {
            response.setDisplayTitle("Showtime #" + showtime.getId());
            response.setDisplayType("SHOWTIME");
        }

        roomRepository.findById(showtime.getRoomId()).ifPresent(room -> {
            response.setRoomName(room.getName());
            Cinema cinema = room.getCinema();
            if (cinema != null) {
                response.setCinemaId(cinema.getId());
                response.setCinemaName(cinema.getName());
            }
        });

        seatTemplateRepository.findById(seat.getSeatTemplateId()).ifPresent(template -> enrichSeatInfo(response, template));
    }

    private void enrichSeatInfo(TicketResponse response, SeatTemplate template) {
        response.setSeatTemplateId(template.getId());
        response.setSeatLabel(template.getRowLabel() + template.getColumnNumber());
        response.setRowLabel(template.getRowLabel());
        response.setColumnNumber(template.getColumnNumber());

        SeatType seatType = template.getSeatType();
        SeatType.SeatTypeCode code = seatType != null && seatType.getCode() != null
            ? seatType.getCode()
            : SeatType.SeatTypeCode.STANDARD;
        response.setSeatType(code.name().toLowerCase());
        response.setSeatTypeCode(code.name());
        response.setSeatTypeName(seatType != null && seatType.getDisplayName() != null ? seatType.getDisplayName() : toDisplayName(code));
        response.setColumnSpan(template.getColumnSpan() != null ? template.getColumnSpan() : 1);
    }

    private String toDisplayName(SeatType.SeatTypeCode code) {
        return switch (code) {
            case VIP -> "VIP";
            case COUPLE -> "Couple";
            case STANDARD -> "Standard";
        };
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
