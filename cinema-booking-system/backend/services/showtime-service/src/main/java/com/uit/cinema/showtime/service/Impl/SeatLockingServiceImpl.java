package com.uit.cinema.showtime.service.Impl;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import com.uit.cinema.showtime.service.SeatHoldPolicy;
import com.uit.cinema.showtime.service.SeatLockingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    private static final DefaultRedisScript<Long> RELEASE_OWNED_HOLD = new DefaultRedisScript<>(
        "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
        Long.class
    );

    private final RedisTemplate<String, Object> redisTemplate;
    private final ShowtimeSeatRepository showtimeSeatRepository;

    @Override
    @Transactional
    public void holdSeats(Long showtimeId, List<Long> seatIds, Long userId) {
        for (Long seatId : seatIds) {
            String lockKey = SeatHoldPolicy.holdKey(showtimeId, seatId);
            Boolean acquired = redisTemplate.opsForValue().setIfAbsent(lockKey, userId.toString(), SeatHoldPolicy.HOLD_TTL);
            if (!Boolean.TRUE.equals(acquired)) {
                // Key already exists — check if it belongs to the same user (re-hold)
                Object existingHolder = redisTemplate.opsForValue().get(lockKey);
                if (existingHolder != null && userId.toString().equals(existingHolder.toString())) {
                    // Same user re-holding: just refresh the TTL
                    redisTemplate.expire(lockKey, SeatHoldPolicy.HOLD_TTL);
                } else {
                    throw new CustomException(
                        "Ghế " + seatId + " đang được người khác giữ, vui lòng chọn ghế khác",
                        HttpStatus.CONFLICT, "SEAT_ALREADY_HELD"
                    );
                }
            } else {
                // First-time hold: update seat status in DB
                showtimeSeatRepository.findById(seatId).ifPresent(seat -> {
                    if (seat.getStatus() != ShowtimeSeat.SeatStatus.AVAILABLE) {
                        redisTemplate.delete(lockKey);
                        throw new CustomException("Ghế không khả dụng", HttpStatus.CONFLICT, "SEAT_NOT_AVAILABLE");
                    }
                    seat.setStatus(ShowtimeSeat.SeatStatus.HELD);
                    showtimeSeatRepository.save(seat);
                });
            }
        }
        log.info("User {} held {} seats for showtime {}", userId, seatIds.size(), showtimeId);
    }

    @Override
    @Transactional
    public void releaseHold(Long showtimeId, Long seatId) {
        redisTemplate.delete(SeatHoldPolicy.holdKey(showtimeId, seatId));
        markSeatAvailable(seatId);
    }

    @Override
    @Transactional
    public void releaseHold(Long showtimeId, Long seatId, Long userId) {
        String lockKey = SeatHoldPolicy.holdKey(showtimeId, seatId);
        Long released = redisTemplate.execute(RELEASE_OWNED_HOLD, List.of(lockKey), userId.toString());
        if (!Long.valueOf(1L).equals(released)) {
            Object currentHolder = redisTemplate.opsForValue().get(lockKey);
            if (currentHolder != null) {
                throw new CustomException(
                    "Seat hold belongs to another user",
                    HttpStatus.FORBIDDEN,
                    "SEAT_HOLD_ACCESS_DENIED"
                );
            }
        }
        markSeatAvailable(seatId);
    }

    private void markSeatAvailable(Long seatId) {
        showtimeSeatRepository.findById(seatId).ifPresent(seat -> {
            if (seat.getStatus() == ShowtimeSeat.SeatStatus.HELD) {
                seat.setStatus(ShowtimeSeat.SeatStatus.AVAILABLE);
                showtimeSeatRepository.save(seat);
            }
        });
    }
}
