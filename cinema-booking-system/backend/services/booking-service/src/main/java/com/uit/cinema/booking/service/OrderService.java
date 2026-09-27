package com.uit.cinema.booking.service;

import com.uit.cinema.booking.entity.Order;
import java.util.List;

public interface OrderService {
    Order createOrder(Long userId, Long showtimeId, List<Long> seatIds, String voucherCode);
}
