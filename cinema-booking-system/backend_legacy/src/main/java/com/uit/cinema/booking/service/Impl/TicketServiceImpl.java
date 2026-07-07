package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.dto.response.TicketResponse;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.mapper.TicketMapper;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.booking.service.TicketGenerationService;
import com.uit.cinema.booking.service.TicketService;
import com.uit.cinema.catalog.service.CatalogReadService;
import com.uit.cinema.catalog.service.contract.CatalogContentView;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.facility.service.FacilityReadService;
import com.uit.cinema.facility.service.contract.FacilityRoomView;
import com.uit.cinema.facility.service.contract.FacilitySeatTemplateView;
import com.uit.cinema.showtime.service.SeatReservationService;
import com.uit.cinema.showtime.service.contract.ShowtimeScheduleView;
import com.uit.cinema.showtime.service.contract.ShowtimeSeatView;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class TicketServiceImpl implements TicketService {

    private final TicketRepository ticketRepository;
    private final TicketGenerationService ticketGenerationService;
    private final TicketMapper ticketMapper;
    private final SeatReservationService seatReservationService;
    private final CatalogReadService catalogReadService;
    private final FacilityReadService facilityReadService;

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
        Optional<ShowtimeSeatView> seat = optional(seatReservationService.findSeat(response.getShowtimeSeatId()));
        if (seat.isEmpty()) {
            response.setRefundable(false);
            response.setRefundPercent(0);
            return;
        }

        Optional<ShowtimeScheduleView> showtime = optional(seatReservationService.findSchedule(seat.get().showtimeId()));
        if (showtime.isEmpty()) {
            response.setRefundable(false);
            response.setRefundPercent(0);
            return;
        }

        enrichShowtimeInfo(response, seat.get(), showtime.get());
        if (response.getStatus() != Ticket.TicketStatus.VALID) {
            response.setRefundable(false);
            response.setRefundPercent(0);
            return;
        }

        int refundPercent = calculateRefundPercent(showtime.get().startTime(), LocalDateTime.now());
        response.setRefundPercent(refundPercent);
        response.setRefundable(refundPercent > 0);
    }

    private void enrichShowtimeInfo(TicketResponse response, ShowtimeSeatView seat, ShowtimeScheduleView showtime) {
        response.setShowtimeId(showtime.showtimeId());
        response.setMovieId(showtime.movieId());
        response.setEventId(showtime.eventId());
        response.setRoomId(showtime.roomId());
        response.setStartTime(showtime.startTime());
        response.setEndTime(showtime.endTime());

        optional(catalogReadService.findMovie(showtime.movieId()))
            .map(CatalogContentView::title)
            .ifPresent(title -> {
                response.setMovieTitle(title);
                response.setDisplayTitle(title);
                response.setDisplayType("MOVIE");
            });
        if (response.getDisplayTitle() == null) {
            optional(catalogReadService.findEvent(showtime.eventId()))
                .map(CatalogContentView::title)
                .ifPresent(title -> {
                    response.setEventTitle(title);
                    response.setDisplayTitle(title);
                    response.setDisplayType("EVENT");
                });
        }
        if (response.getDisplayTitle() == null) {
            response.setDisplayTitle("Showtime #" + showtime.showtimeId());
            response.setDisplayType("SHOWTIME");
        }

        optional(facilityReadService.findRoom(showtime.roomId())).ifPresent(room -> enrichRoomInfo(response, room));
        optional(facilityReadService.findSeatTemplate(seat.seatTemplateId())).ifPresent(template -> enrichSeatInfo(response, template));
    }

    private void enrichRoomInfo(TicketResponse response, FacilityRoomView room) {
        response.setRoomName(room.roomName());
        response.setCinemaId(room.cinemaId());
        response.setCinemaName(room.cinemaName());
    }

    private void enrichSeatInfo(TicketResponse response, FacilitySeatTemplateView template) {
        response.setSeatTemplateId(template.seatTemplateId());
        response.setSeatLabel(template.label());
        response.setRowLabel(template.rowLabel());
        response.setColumnNumber(template.columnNumber());
        response.setSeatType(template.seatType());
        response.setSeatTypeCode(template.seatTypeCode());
        response.setSeatTypeName(template.seatTypeName());
        response.setColumnSpan(template.columnSpan());
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

    private <T> Optional<T> optional(Optional<T> value) {
        return value != null ? value : Optional.empty();
    }
}
