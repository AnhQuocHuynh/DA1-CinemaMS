package com.uit.cinema.showtime.service.Impl;

import com.uit.cinema.catalog.service.CatalogReadService;
import com.uit.cinema.catalog.service.contract.CatalogContentView;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.facility.service.FacilityReadService;
import com.uit.cinema.facility.service.contract.FacilityRoomView;
import com.uit.cinema.facility.service.contract.FacilitySeatTemplateView;
import com.uit.cinema.showtime.dto.request.ShowtimeRequest;
import com.uit.cinema.showtime.dto.response.ShowtimeResponse;
import com.uit.cinema.showtime.dto.response.ShowtimeSeatResponse;
import com.uit.cinema.showtime.entity.Showtime;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.mapper.ShowtimeMapper;
import com.uit.cinema.showtime.repository.ShowtimeRepository;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import com.uit.cinema.showtime.service.SeatHoldPolicy;
import com.uit.cinema.showtime.service.ShowtimeService;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ShowtimeServiceImpl implements ShowtimeService {

    private static final Duration BOOKING_CUTOFF_BEFORE_START = Duration.ofMinutes(15);

    private final ShowtimeRepository showtimeRepository;
    private final ShowtimeSeatRepository showtimeSeatRepository;
    private final ShowtimeMapper showtimeMapper;
    private final RedisTemplate<String, Object> redisTemplate;
    private final EntityManager entityManager;
    private final FacilityReadService facilityReadService;
    private final CatalogReadService catalogReadService;

    @Override
    public List<ShowtimeResponse> getShowtimesByMovie(Long movieId) {
        LocalDateTime minStartTime = LocalDateTime.now().plus(BOOKING_CUTOFF_BEFORE_START);
        return showtimeRepository.findByMovieIdAndStartTimeAfterOrderByStartTimeAsc(movieId, minStartTime)
            .stream()
            .filter(showtime -> showtime.getStatus() == Showtime.Status.SCHEDULED)
            .map(this::enrichWithRoomData)
            .collect(Collectors.toList());
    }

    @Override
    public List<ShowtimeResponse> getShowtimesByEvent(Long eventId) {
        LocalDateTime minStartTime = LocalDateTime.now().plus(BOOKING_CUTOFF_BEFORE_START);
        return showtimeRepository.findByEventIdAndStartTimeAfterOrderByStartTimeAsc(eventId, minStartTime)
            .stream()
            .filter(showtime -> showtime.getStatus() == Showtime.Status.SCHEDULED)
            .map(this::enrichWithRoomData)
            .collect(Collectors.toList());
    }

    @Override
    public List<ShowtimeResponse> getShowtimesByRoom(Long roomId) {
        return showtimeRepository.findByRoomIdOrderByStartTimeAsc(roomId)
            .stream()
            .map(this::enrichWithRoomData)
            .collect(Collectors.toList());
    }

    @Override
    public ShowtimeResponse getShowtimeById(Long id) {
        Showtime showtime = showtimeRepository.findById(id)
            .orElseThrow(() -> new CustomException("Showtime not found", HttpStatus.NOT_FOUND, "SHOWTIME_NOT_FOUND"));
        return enrichWithRoomData(showtime);
    }

    @Override
    public List<ShowtimeSeatResponse> getSeatMap(Long showtimeId) {
        return showtimeSeatRepository.findByShowtimeId(showtimeId).stream()
            .map(seat -> toRealtimeSeatResponse(showtimeId, seat))
            .toList();
    }

    @Override
    public ShowtimeSeatResponse getSeatById(Long seatId) {
        ShowtimeSeat seat = showtimeSeatRepository.findById(seatId)
            .orElseThrow(() -> new CustomException("Seat not found", HttpStatus.NOT_FOUND, "SEAT_NOT_FOUND"));
        return toRealtimeSeatResponse(seat.getShowtimeId(), seat);
    }

    @Override
    @Transactional
    public ShowtimeResponse createShowtime(ShowtimeRequest request) {
        if (request.getMovieId() == null && request.getEventId() == null) {
            throw new CustomException("Movie ID or Event ID is required", HttpStatus.BAD_REQUEST, "MISSING_REFERENCE_ID");
        }

        validateShowtimeTarget(request);

        FacilityRoomView room = facilityReadService.findRoom(request.getRoomId())
            .orElseThrow(() -> new CustomException("Room not found", HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND"));

        if (room.isUnderMaintenance()) {
            throw new CustomException("Room is under maintenance", HttpStatus.BAD_REQUEST, "ROOM_UNDER_MAINTENANCE");
        }

        Long overlapCount = entityManager.createQuery(
            "SELECT COUNT(s) FROM Showtime s WHERE s.roomId = :roomId " +
            "AND s.status <> 'CANCELLED' " +
            "AND s.startTime < :endTime AND s.endTime > :startTime", Long.class)
            .setParameter("roomId", request.getRoomId())
            .setParameter("startTime", request.getStartTime())
            .setParameter("endTime", request.getEndTime())
            .getSingleResult();

        if (overlapCount > 0) {
            throw new CustomException("Showtime overlaps another showtime", HttpStatus.CONFLICT, "CONFLICT");
        }

        Showtime showtime = showtimeMapper.toEntity(request);
        Showtime savedShowtime = showtimeRepository.save(showtime);

        List<FacilitySeatTemplateView> templates = facilityReadService.findActiveSeatTemplatesByRoom(savedShowtime.getRoomId());
        for (FacilitySeatTemplateView template : templates) {
            ShowtimeSeat seat = ShowtimeSeat.builder()
                .showtimeId(savedShowtime.getId())
                .seatTemplateId(template.seatTemplateId())
                .price(calculateSeatPrice(savedShowtime.getBasePrice(), template))
                .status(ShowtimeSeat.SeatStatus.AVAILABLE)
                .build();
            showtimeSeatRepository.save(seat);
        }

        ShowtimeResponse response = showtimeMapper.toResponse(savedShowtime);
        enrichDisplayTitle(savedShowtime, response);
        response.setRoomName(room.roomName());
        if (room.cinemaId() != null) {
            response.setCinemaId(room.cinemaId());
            response.setCinemaName(room.cinemaName());
        }
        return response;
    }

    @Override
    @Transactional
    public void deleteShowtime(Long id) {
        if (!showtimeRepository.existsById(id)) {
            throw new CustomException("Showtime not found", HttpStatus.NOT_FOUND, "SHOWTIME_NOT_FOUND");
        }
        showtimeSeatRepository.deleteByShowtimeId(id);
        showtimeRepository.deleteById(id);
    }

    private ShowtimeResponse enrichWithRoomData(Showtime showtime) {
        ShowtimeResponse response = showtimeMapper.toResponse(showtime);
        enrichDisplayTitle(showtime, response);
        if (showtime.getRoomId() != null) {
            try {
                facilityReadService.findRoom(showtime.getRoomId()).ifPresent(room -> {
                    response.setRoomName(room.roomName());
                    response.setCinemaId(room.cinemaId());
                    response.setCinemaName(room.cinemaName());
                });
            } catch (Exception ignored) {
                // Keep the showtime response available even if the facility projection is temporarily unavailable.
            }
        }
        return response;
    }

    private void validateShowtimeTarget(ShowtimeRequest request) {
        if (request.getMovieId() == null && request.getEventId() == null) {
            throw new CustomException("Showtime must reference a movie or an event", HttpStatus.BAD_REQUEST, "SHOWTIME_TARGET_REQUIRED");
        }
        if (request.getMovieId() != null) {
            CatalogContentView movie = catalogReadService.findMovie(request.getMovieId())
                .orElseThrow(() -> new CustomException("Movie not found", HttpStatus.NOT_FOUND, "MOVIE_NOT_FOUND"));
            if (request.getStartTime() != null && movie.releaseDate() != null
                && request.getStartTime().toLocalDate().isBefore(movie.releaseDate())) {
                throw new CustomException("Showtime cannot be created before movie release date", HttpStatus.BAD_REQUEST, "SHOWTIME_BEFORE_RELEASE_DATE");
            }
        }
        if (request.getEventId() != null && catalogReadService.findEvent(request.getEventId()).isEmpty()) {
            throw new CustomException("Event not found", HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND");
        }
    }

    private void enrichDisplayTitle(Showtime showtime, ShowtimeResponse response) {
        if (showtime.getMovieId() != null) {
            catalogReadService.findMovie(showtime.getMovieId()).ifPresent(movie -> {
                response.setDisplayTitle(movie.title());
                response.setDisplayType("MOVIE");
            });
        }
        if (response.getDisplayTitle() == null && showtime.getEventId() != null) {
            catalogReadService.findEvent(showtime.getEventId()).ifPresent(event -> {
                response.setEventName(event.title());
                response.setDisplayTitle(event.title());
                response.setDisplayType("EVENT");
            });
        }
        if (response.getDisplayTitle() == null) {
            response.setDisplayTitle("Showtime #" + showtime.getId());
            response.setDisplayType("SHOWTIME");
        }
    }

    private ShowtimeSeatResponse toRealtimeSeatResponse(Long showtimeId, ShowtimeSeat seat) {
        ShowtimeSeatResponse response = showtimeMapper.toSeatResponse(seat);
        String holdKey = SeatHoldPolicy.holdKey(showtimeId, seat.getId());
        Long ttlSeconds = redisTemplate.getExpire(holdKey);
        response.setHoldTtlSeconds((ttlSeconds != null && ttlSeconds > 0) ? ttlSeconds : null);
        response.setSeatId(String.valueOf(seat.getId()));
        response.setStatus(mapSeatStatus(seat.getStatus(), response.getHoldTtlSeconds()));

        facilityReadService.findSeatTemplate(seat.getSeatTemplateId()).ifPresent(template -> {
            response.setRowLabel(template.rowLabel());
            response.setColumnNumber(template.columnNumber());
            response.setLabel(template.label());
            response.setIsPathway(template.isPathway());
            applySeatTypeContract(response, template);
        });

        if (response.getIsPathway() == null) {
            response.setIsPathway(false);
        }
        if (response.getSeatType() == null) {
            response.setSeatType("standard");
            response.setSeatTypeCode("STANDARD");
            response.setSeatTypeName("Standard");
            response.setSeatKind("STANDARD");
            response.setColumnSpan(1);
        }
        return response;
    }

    private BigDecimal calculateSeatPrice(BigDecimal basePrice, FacilitySeatTemplateView template) {
        BigDecimal safeBasePrice = basePrice != null ? basePrice : BigDecimal.ZERO;
        return safeBasePrice.multiply(template.effectivePriceMultiplier());
    }

    private void applySeatTypeContract(ShowtimeSeatResponse response, FacilitySeatTemplateView template) {
        String code = template.seatTypeCode() != null ? template.seatTypeCode() : "STANDARD";
        String displayName = template.seatTypeName() != null ? template.seatTypeName() : toDisplayName(code);
        Integer columnSpan = template.columnSpan() != null ? template.columnSpan() : 1;

        response.setSeatType(code.toLowerCase(Locale.ROOT));
        response.setSeatTypeCode(code);
        response.setSeatTypeName(displayName);
        response.setSeatKind(code);
        response.setColumnSpan(columnSpan);
    }

    private String toDisplayName(String code) {
        return switch (code) {
            case "VIP" -> "VIP";
            case "COUPLE" -> "Couple";
            case "STANDARD" -> "Standard";
            default -> code;
        };
    }

    private String mapSeatStatus(ShowtimeSeat.SeatStatus status, Long holdTtlSeconds) {
        if (status == ShowtimeSeat.SeatStatus.BOOKED) {
            return "sold";
        }
        if (status == ShowtimeSeat.SeatStatus.HELD || (holdTtlSeconds != null && holdTtlSeconds > 0)) {
            return "holding";
        }
        return "available";
    }
}
