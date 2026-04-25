package com.uit.cinema.showtime.service;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;

/**
 * Xử lý giữ ghế tạm thời (Holding) bằng Redis.
 * Mỗi ghế được khoá trong TTL_MINUTES phút; khi hết TTL Redis tự xoá khoá,
 * ghế tự động trở về trạng thái AVAILABLE.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SeatLockingServiceImpl implements SeatLockingService {

    private static final String LOCK_PREFIX = "seat:lock:";
    private static final Duration TTL = Duration.ofMinutes(10);

    private final RedisTemplate<String, Object> redisTemplate;
    private final ShowtimeSeatRepository showtimeSeatRepository;

    @Override
    @Transactional
    public void holdSeats(Long showtimeId, List<Long> seatIds, Long userId) {
        for (Long seatId : seatIds) {
            String lockKey = buildKey(showtimeId, seatId);
            Boolean acquired = redisTemplate.opsForValue().setIfAbsent(lockKey, userId.toString(), TTL);
            if (!Boolean.TRUE.equals(acquired)) {
                throw new CustomException(
                    "Ghế " + seatId + " đang được người khác giữ, vui lòng chọn ghế khác",
                    HttpStatus.CONFLICT, "SEAT_ALREADY_HELD"
                );
            }
            showtimeSeatRepository.findById(seatId).ifPresent(seat -> {
                if (seat.getStatus() != ShowtimeSeat.SeatStatus.AVAILABLE) {
                    redisTemplate.delete(lockKey);
                    throw new CustomException("Ghế không khả dụng", HttpStatus.CONFLICT, "SEAT_NOT_AVAILABLE");
                }
                seat.setStatus(ShowtimeSeat.SeatStatus.HELD);
                showtimeSeatRepository.save(seat);
            });
        }
        log.info("User {} held {} seats for showtime {}", userId, seatIds.size(), showtimeId);
    }

    @Override
    public void releaseHold(Long showtimeId, Long seatId) {
        redisTemplate.delete(buildKey(showtimeId, seatId));
        showtimeSeatRepository.findById(seatId).ifPresent(seat -> {
            if (seat.getStatus() == ShowtimeSeat.SeatStatus.HELD) {
                seat.setStatus(ShowtimeSeat.SeatStatus.AVAILABLE);
                showtimeSeatRepository.save(seat);
            }
        });
    }

    private String buildKey(Long showtimeId, Long seatId) {
        return LOCK_PREFIX + showtimeId + ":" + seatId;
    }
}
