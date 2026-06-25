package com.uit.cinema.showtime.service.Impl;

import com.uit.cinema.facility.entity.SeatTemplate;
import com.uit.cinema.facility.entity.SeatType;
import com.uit.cinema.facility.repository.SeatTemplateRepository;
import jakarta.persistence.EntityManager;
import com.uit.cinema.catalog.entity.Event;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.repository.EventRepository;
import com.uit.cinema.catalog.repository.MovieRepository;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.dto.request.ShowtimeRequest;
import com.uit.cinema.showtime.dto.response.ShowtimeResponse;
import com.uit.cinema.showtime.dto.response.ShowtimeSeatResponse;
import com.uit.cinema.showtime.entity.Showtime;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.mapper.ShowtimeMapper;
import com.uit.cinema.showtime.repository.ShowtimeRepository;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import com.uit.cinema.facility.dto.response.RoomResponse;
import com.uit.cinema.facility.service.RoomService;
import com.uit.cinema.showtime.service.SeatHoldPolicy;
import com.uit.cinema.showtime.service.ShowtimeService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
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
    private final SeatTemplateRepository seatTemplateRepository;
    private final RoomService roomService;
    private final MovieRepository movieRepository;
    private final EventRepository eventRepository;

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
            throw new CustomException("Phải cung cấp Movie ID hoặc Event ID", HttpStatus.BAD_REQUEST, "MISSING_REFERENCE_ID");
        }

        //validateShowtimeTarget(request);
        // Check room maintenance status
        RoomResponse room = null;
        try {
            room = roomService.getRoomById(request.getRoomId());
        } catch (CustomException e) {
            throw new CustomException("Phòng chiếu không tồn tại", HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND");
        }
        
        if (room.isUnderMaintenance()) {
            throw new CustomException("Phòng chiếu đang bảo trì, không thể tạo suất chiếu", HttpStatus.BAD_REQUEST, "ROOM_UNDER_MAINTENANCE");
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
            throw new CustomException("Suất chiếu bị trùng lặp thời gian", HttpStatus.CONFLICT, "CONFLICT");
        }

        Showtime showtime = showtimeMapper.toEntity(request);
        Showtime savedShowtime = showtimeRepository.save(showtime);

        // Fetch seat templates for the showtime's room and generate showtime seats
        List<SeatTemplate> templates = entityManager.createQuery(
                "SELECT t FROM SeatTemplate t WHERE t.room.id = :roomId AND t.active = true",
                SeatTemplate.class
        )
        .setParameter("roomId", savedShowtime.getRoomId())
        .getResultList();

        for (SeatTemplate template : templates) {
            ShowtimeSeat seat = ShowtimeSeat.builder()
                    .showtimeId(savedShowtime.getId())
                    .seatTemplateId(template.getId())
                    .price(calculateSeatPrice(savedShowtime.getBasePrice(), template))
                    .status(ShowtimeSeat.SeatStatus.AVAILABLE)
                    .build();
            showtimeSeatRepository.save(seat);
        }

        ShowtimeResponse response = showtimeMapper.toResponse(savedShowtime);
        enrichDisplayTitle(savedShowtime, response);
        if (room != null) {
            response.setRoomName(room.getName());
            if (room.getCinemaId() != null) {
                response.setCinemaId(room.getCinemaId());
                response.setCinemaName(room.getCinemaName());
            }
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
                RoomResponse room = roomService.getRoomById(showtime.getRoomId());
                response.setRoomName(room.getName());
                response.setCinemaId(room.getCinemaId());
                response.setCinemaName(room.getCinemaName());
            } catch (Exception e) {
                // Room not found or other error, just return basic response
            }
        }
        return response;
    }

    private void validateShowtimeTarget(ShowtimeRequest request) {
        if (request.getMovieId() == null && request.getEventId() == null) {
            throw new CustomException("Showtime must reference a movie or an event", HttpStatus.BAD_REQUEST, "SHOWTIME_TARGET_REQUIRED");
        }
        if (request.getMovieId() != null && !movieRepository.existsById(request.getMovieId())) {
            throw new CustomException("Movie not found", HttpStatus.NOT_FOUND, "MOVIE_NOT_FOUND");
        }
        if (request.getEventId() != null && !eventRepository.existsById(request.getEventId())) {
            throw new CustomException("Event not found", HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND");
        }
    }

    private void enrichDisplayTitle(Showtime showtime, ShowtimeResponse response) {
        if (showtime.getMovieId() != null) {
            movieRepository.findById(showtime.getMovieId())
                .map(Movie::getTitle)
                .ifPresent(title -> {
                    response.setDisplayTitle(title);
                    response.setDisplayType("MOVIE");
                });
        }
        if (response.getDisplayTitle() == null && showtime.getEventId() != null) {
            eventRepository.findById(showtime.getEventId())
                .ifPresent(event -> {
                    response.setEventName(event.getName());
                    response.setDisplayTitle(event.getName());
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

        seatTemplateRepository.findById(seat.getSeatTemplateId()).ifPresent(template -> {
            response.setRowLabel(template.getRowLabel());
            response.setColumnNumber(template.getColumnNumber());
            response.setLabel(template.getRowLabel() + template.getColumnNumber());
            response.setIsPathway(template.isPathway());
            applySeatTypeContract(response, template);
        });

        if (response.getIsPathway() == null) {
            response.setIsPathway(false);
        }
        if (response.getSeatType() == null) {
            response.setSeatType("standard");
            response.setSeatTypeCode(SeatType.SeatTypeCode.STANDARD.name());
            response.setSeatTypeName("Standard");
            response.setSeatKind(SeatType.SeatTypeCode.STANDARD.name());
            response.setColumnSpan(1);
        }
        return response;
    }

    private BigDecimal calculateSeatPrice(BigDecimal basePrice, SeatTemplate template) {
        BigDecimal multiplier = BigDecimal.ONE;
        if (template.getSeatType() != null && template.getSeatType().getPriceMultiplier() != null) {
            multiplier = template.getSeatType().getPriceMultiplier();
        }
        return basePrice.multiply(multiplier);
    }

    private void applySeatTypeContract(ShowtimeSeatResponse response, SeatTemplate template) {
        SeatType seatType = template.getSeatType();
        SeatType.SeatTypeCode code = seatType != null && seatType.getCode() != null
            ? seatType.getCode()
            : SeatType.SeatTypeCode.STANDARD;
        String displayName = seatType != null && seatType.getDisplayName() != null
            ? seatType.getDisplayName()
            : toDisplayName(code);
        Integer columnSpan = template.getColumnSpan() != null
            ? template.getColumnSpan()
            : seatType != null && seatType.getDefaultColumnSpan() != null ? seatType.getDefaultColumnSpan() : 1;

        response.setSeatType(code.name().toLowerCase());
        response.setSeatTypeCode(code.name());
        response.setSeatTypeName(displayName);
        response.setSeatKind(code.name());
        response.setColumnSpan(columnSpan);
    }

    private String toDisplayName(SeatType.SeatTypeCode code) {
        return switch (code) {
            case VIP -> "VIP";
            case COUPLE -> "Couple";
            case STANDARD -> "Standard";
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
