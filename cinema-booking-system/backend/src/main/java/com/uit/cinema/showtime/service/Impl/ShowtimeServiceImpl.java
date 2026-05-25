package com.uit.cinema.showtime.service.Impl;

import com.uit.cinema.facility.entity.SeatTemplate;
import jakarta.persistence.EntityManager;
import com.uit.cinema.core.exception.CustomException;
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
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Override
    public List<ShowtimeResponse> getShowtimesByMovie(Long movieId) {
        LocalDateTime minStartTime = LocalDateTime.now().plus(BOOKING_CUTOFF_BEFORE_START);
        return showtimeRepository.findByMovieIdAndStartTimeAfterOrderByStartTimeAsc(movieId, minStartTime)
            .stream()
            .filter(showtime -> showtime.getStatus() == Showtime.Status.SCHEDULED)
            .map(showtimeMapper::toResponse)
            .collect(Collectors.toList());
    }

    @Override
    public ShowtimeResponse getShowtimeById(Long id) {
        Showtime showtime = showtimeRepository.findById(id)
            .orElseThrow(() -> new CustomException("Showtime not found", HttpStatus.NOT_FOUND, "SHOWTIME_NOT_FOUND"));
        return showtimeMapper.toResponse(showtime);
    }

    @Override
    public List<ShowtimeSeatResponse> getSeatMap(Long showtimeId) {
        return showtimeSeatRepository.findByShowtimeId(showtimeId).stream()
            .map(seat -> toRealtimeSeatResponse(showtimeId, seat))
            .toList();
    }

    @Override
    @Transactional
    public ShowtimeResponse createShowtime(ShowtimeRequest request) {
        // Check room maintenance status
        com.uit.cinema.facility.entity.Room room = entityManager.find(com.uit.cinema.facility.entity.Room.class, request.getRoomId());
        if (room == null) {
            throw new CustomException("Phòng chiếu không tồn tại", HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND");
        }
        if (room.isUnderMaintenance()) {
            throw new CustomException("Phòng chiếu đang bảo trì, không thể tạo suất chiếu", HttpStatus.BAD_REQUEST, "ROOM_UNDER_MAINTENANCE");
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
                    .price(savedShowtime.getBasePrice())
                    .status(ShowtimeSeat.SeatStatus.AVAILABLE)
                    .build();
            showtimeSeatRepository.save(seat);
        }

        return showtimeMapper.toResponse(savedShowtime);
    }

    private ShowtimeSeatResponse toRealtimeSeatResponse(Long showtimeId, ShowtimeSeat seat) {
        ShowtimeSeatResponse response = showtimeMapper.toSeatResponse(seat);
        String holdKey = SeatHoldPolicy.holdKey(showtimeId, seat.getId());
        Long ttlSeconds = redisTemplate.getExpire(holdKey);
        response.setHoldTtlSeconds((ttlSeconds != null && ttlSeconds > 0) ? ttlSeconds : null);
        return response;
    }
}
