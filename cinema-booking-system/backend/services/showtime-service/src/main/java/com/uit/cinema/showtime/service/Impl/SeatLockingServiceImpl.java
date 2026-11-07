package com.uit.cinema.showtime.service.Impl;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import com.uit.cinema.showtime.service.SeatHoldPolicy;
import com.uit.cinema.showtime.service.SeatLockingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Giữ ghế bằng Redis khi broker còn sống. Khi Redis không kết nối được,
 * cùng một giao dịch lấy khóa dòng trên showtime_seats (SELECT FOR UPDATE)
 * và ghi người giữ cùng thời điểm hết hạn.
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
            holdOne(showtimeId, seatId, userId);
        }
        log.info("User {} held {} seats for showtime {}", userId, seatIds.size(), showtimeId);
    }

    @Override
    @Transactional
    public void releaseHold(Long showtimeId, Long seatId) {
        String lockKey = SeatHoldPolicy.holdKey(showtimeId, seatId);
        try {
            redisTemplate.delete(lockKey);
        } catch (DataAccessException exception) {
            log.warn("Redis unavailable while releasing seat {} for showtime {}. Clearing the database hold.", seatId, showtimeId);
        }
        releaseDatabaseHold(seatId, null);
    }

    @Override
    @Transactional
    public void releaseHold(Long showtimeId, Long seatId, Long userId) {
        String lockKey = SeatHoldPolicy.holdKey(showtimeId, seatId);
        try {
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
        } catch (DataAccessException exception) {
            log.warn("Redis unavailable while releasing seat {} for showtime {}. Using the database hold.", seatId, showtimeId);
        }
        releaseDatabaseHold(seatId, userId);
    }

    private void holdOne(Long showtimeId, Long seatId, Long userId) {
        String lockKey = SeatHoldPolicy.holdKey(showtimeId, seatId);
        boolean mirroredToRedis = false;
        try {
            mirroredToRedis = mirrorRedisHold(lockKey, showtimeId, seatId, userId);
        } catch (DataAccessException exception) {
            log.warn(
                "Redis unavailable, falling back to database lock for showtime {} seat {}",
                showtimeId,
                seatId
            );
        }

        try {
            lockSeatInDatabase(showtimeId, seatId, userId);
        } catch (RuntimeException exception) {
            if (mirroredToRedis) {
                deleteRedisKeyQuietly(lockKey);
            }
            throw exception;
        }
    }

    /**
     * @return true when this call created the Redis key
     */
    private boolean mirrorRedisHold(String lockKey, Long showtimeId, Long seatId, Long userId) {
        Boolean acquired = redisTemplate.opsForValue().setIfAbsent(lockKey, userId.toString(), SeatHoldPolicy.HOLD_TTL);
        if (Boolean.TRUE.equals(acquired)) {
            return true;
        }

        Object existingHolder;
        try {
            existingHolder = redisTemplate.opsForValue().get(lockKey);
        } catch (DataAccessException exception) {
            log.warn("Redis failed while reading the existing lock for seat {}", seatId);
            throw new CustomException(
                "Không thể kiểm tra khóa ghế, vui lòng thử lại",
                HttpStatus.SERVICE_UNAVAILABLE,
                "SEAT_LOCK_UNAVAILABLE"
            );
        }

        if (existingHolder != null && userId.toString().equals(existingHolder.toString())) {
            try {
                redisTemplate.expire(lockKey, SeatHoldPolicy.HOLD_TTL);
            } catch (DataAccessException exception) {
                log.warn("Redis failed while refreshing the hold for seat {}", seatId);
            }
            return false;
        }

        if (canReplaceStaleRedisKey(showtimeId, seatId, userId, existingHolder)) {
            try {
                redisTemplate.delete(lockKey);
                Boolean replaced = redisTemplate.opsForValue().setIfAbsent(lockKey, userId.toString(), SeatHoldPolicy.HOLD_TTL);
                if (Boolean.TRUE.equals(replaced)) {
                    return true;
                }
            } catch (DataAccessException exception) {
                log.warn("Redis failed while replacing a stale lock for seat {}", seatId);
                throw new CustomException(
                    "Không thể kiểm tra khóa ghế, vui lòng thử lại",
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "SEAT_LOCK_UNAVAILABLE"
                );
            }
        }

        throw new CustomException(
            "Ghế " + seatId + " đang được người khác giữ, vui lòng chọn ghế khác",
            HttpStatus.CONFLICT,
            "SEAT_ALREADY_HELD"
        );
    }

    private boolean canReplaceStaleRedisKey(Long showtimeId, Long seatId, Long userId, Object existingHolder) {
        return showtimeSeatRepository.findById(seatId)
            .filter(seat -> showtimeId.equals(seat.getShowtimeId()))
            .filter(seat -> seat.getStatus() != ShowtimeSeat.SeatStatus.BOOKED)
            .filter(seat -> !SeatHoldPolicy.blocksNewHolder(seat, userId, Instant.now()))
            .filter(seat -> seat.getHoldExpiresAt() != null || existingHolder == null || seat.getStatus() != ShowtimeSeat.SeatStatus.HELD)
            .isPresent();
    }

    private void lockSeatInDatabase(Long showtimeId, Long seatId, Long userId) {
        ShowtimeSeat seat = showtimeSeatRepository.findByIdForUpdate(seatId)
            .orElseThrow(() -> new CustomException("Ghế không tồn tại", HttpStatus.NOT_FOUND, "SEAT_NOT_FOUND"));
        if (!showtimeId.equals(seat.getShowtimeId())) {
            throw new CustomException("Ghế không thuộc suất chiếu này", HttpStatus.CONFLICT, "SEAT_SHOWTIME_MISMATCH");
        }
        if (seat.getStatus() == ShowtimeSeat.SeatStatus.BOOKED) {
            throw new CustomException("Ghế không khả dụng", HttpStatus.CONFLICT, "SEAT_NOT_AVAILABLE");
        }

        Instant now = Instant.now();
        if (SeatHoldPolicy.blocksNewHolder(seat, userId, now)) {
            throw new CustomException(
                "Ghế " + seatId + " đang được người khác giữ, vui lòng chọn ghế khác",
                HttpStatus.CONFLICT,
                "SEAT_ALREADY_HELD"
            );
        }

        seat.setStatus(ShowtimeSeat.SeatStatus.HELD);
        seat.setHeldByUserId(userId);
        seat.setHoldExpiresAt(now.plus(SeatHoldPolicy.HOLD_TTL));
        showtimeSeatRepository.save(seat);
    }

    private void releaseDatabaseHold(Long seatId, Long userId) {
        showtimeSeatRepository.findByIdForUpdate(seatId).ifPresent(seat -> {
            if (seat.getStatus() != ShowtimeSeat.SeatStatus.HELD) {
                return;
            }
            if (userId != null && SeatHoldPolicy.blocksNewHolder(seat, userId, Instant.now())) {
                throw new CustomException(
                    "Seat hold belongs to another user",
                    HttpStatus.FORBIDDEN,
                    "SEAT_HOLD_ACCESS_DENIED"
                );
            }
            seat.setStatus(ShowtimeSeat.SeatStatus.AVAILABLE);
            seat.setHeldByUserId(null);
            seat.setHoldExpiresAt(null);
            showtimeSeatRepository.save(seat);
        });
    }

    private void deleteRedisKeyQuietly(String lockKey) {
        try {
            redisTemplate.delete(lockKey);
        } catch (DataAccessException exception) {
            log.warn("Redis unavailable while rolling back lock {}", lockKey);
        }
    }
}
