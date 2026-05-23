package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Voucher;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.VoucherRepository;
import com.uit.cinema.booking.service.OrderService;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import com.uit.cinema.showtime.service.SeatHoldPolicy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final OrderRepository orderRepository;
    private final VoucherRepository voucherRepository;
    private final ShowtimeSeatRepository showtimeSeatRepository;
    private final RedisTemplate<String, Object> redisTemplate;

    @Override
    @Transactional
    public Order createOrder(Long userId, Long showtimeId, List<Long> seatIds, String voucherCode) {
        if (seatIds == null || seatIds.isEmpty()) {
            throw new CustomException("Seat list is empty", HttpStatus.BAD_REQUEST, "SEAT_LIST_EMPTY");
        }

        List<ShowtimeSeat> seats = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;

        for (Long seatId : seatIds) {
            ShowtimeSeat seat = showtimeSeatRepository.findById(seatId)
                .orElseThrow(() -> new CustomException("Seat not found", HttpStatus.NOT_FOUND, "SEAT_NOT_FOUND"));
            if (!showtimeId.equals(seat.getShowtimeId())) {
                throw new CustomException("Seat does not belong to showtime", HttpStatus.BAD_REQUEST, "SEAT_SHOWTIME_MISMATCH");
            }
            if (seat.getStatus() != ShowtimeSeat.SeatStatus.HELD) {
                throw new CustomException("Seat is not in HELD status", HttpStatus.CONFLICT, "SEAT_NOT_HELD");
            }

            String lockKey = SeatHoldPolicy.holdKey(showtimeId, seatId);
            Object lockHolder = redisTemplate.opsForValue().get(lockKey);
            if (lockHolder == null || !String.valueOf(userId).equals(String.valueOf(lockHolder))) {
                throw new CustomException("Seat hold is invalid or expired", HttpStatus.CONFLICT, "SEAT_HOLD_INVALID");
            }

            seats.add(seat);
            total = total.add(seat.getPrice());
        }

        BigDecimal discount = BigDecimal.ZERO;
        Long voucherId = null;
        if (voucherCode != null && !voucherCode.isBlank()) {
            Voucher voucher = voucherRepository.findByCodeAndActiveTrue(voucherCode)
                .orElseThrow(() -> new CustomException("Invalid voucher", HttpStatus.BAD_REQUEST, "INVALID_VOUCHER"));
            validateVoucher(voucher);
            discount = calculateDiscount(voucher, total);
            voucher.setUsedCount(voucher.getUsedCount() + 1);
            voucherId = voucher.getId();
        }

        BigDecimal finalAmount = total.subtract(discount);
        Order order = Order.builder()
            .userId(userId)
            .showtimeId(showtimeId)
            .seatIdsSnapshot(joinSeatIds(seatIds))
            .voucherId(voucherId)
            .totalAmount(total)
            .discountAmount(discount)
            .finalAmount(finalAmount)
            .status(Order.OrderStatus.PENDING)
            .build();

        Order saved = orderRepository.save(order);
        log.info("Order {} created for user {}, {} seats", saved.getId(), userId, seatIds.size());
        return saved;
    }

    private void validateVoucher(Voucher voucher) {
        LocalDateTime now = LocalDateTime.now();
        if (voucher.getValidUntil() != null && now.isAfter(voucher.getValidUntil())) {
            throw new CustomException("Voucher expired", HttpStatus.BAD_REQUEST, "VOUCHER_EXPIRED");
        }
        if (voucher.getUsageLimit() != null && voucher.getUsedCount() >= voucher.getUsageLimit()) {
            throw new CustomException("Voucher exhausted", HttpStatus.BAD_REQUEST, "VOUCHER_EXHAUSTED");
        }
    }

    private BigDecimal calculateDiscount(Voucher voucher, BigDecimal total) {
        BigDecimal discount = switch (voucher.getDiscountType()) {
            case PERCENTAGE -> total.multiply(voucher.getDiscountValue()).divide(BigDecimal.valueOf(100));
            case FIXED_AMOUNT -> voucher.getDiscountValue();
        };
        if (voucher.getMaxDiscountAmount() != null) {
            discount = discount.min(voucher.getMaxDiscountAmount());
        }
        return discount.min(total);
    }

    private String joinSeatIds(List<Long> seatIds) {
        return seatIds.stream().map(String::valueOf).collect(Collectors.joining(","));
    }
}
