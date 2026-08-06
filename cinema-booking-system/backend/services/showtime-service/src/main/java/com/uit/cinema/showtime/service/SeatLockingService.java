package com.uit.cinema.showtime.service;

import java.util.List;

/**
 * Xử lý giữ ghế tạm thời (Holding) bằng Redis.
 * Mỗi ghế được khoá trong TTL_MINUTES phút; khi hết TTL Redis tự xoá khoá,
 * ghế tự động trở về trạng thái AVAILABLE.
 */
public interface SeatLockingService {
    void holdSeats(Long showtimeId, List<Long> seatIds, Long userId);
    void releaseHold(Long showtimeId, Long seatId);
    void releaseHold(Long showtimeId, Long seatId, Long userId);
}
