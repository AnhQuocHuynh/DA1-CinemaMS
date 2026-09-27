package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Voucher;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.VoucherRepository;
import com.uit.cinema.booking.service.OrderService;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.service.SeatReservationService;
import com.uit.cinema.showtime.service.contract.SeatBookingRequest;
import com.uit.cinema.showtime.service.contract.SeatHoldValidationResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final OrderRepository orderRepository;
    private final VoucherRepository voucherRepository;
    private final SeatReservationService seatReservationService;

    @Override
    @Transactional
    public Order createOrder(Long userId, Long showtimeId, List<Long> seatIds, String voucherCode) {
        if (seatIds == null || seatIds.isEmpty()) {
            throw new CustomException("Seat list is empty", HttpStatus.BAD_REQUEST, "SEAT_LIST_EMPTY");
        }

        SeatHoldValidationResult seatValidation = seatReservationService.validateHeldSeats(
            new SeatBookingRequest(userId, showtimeId, seatIds)
        );
        BigDecimal total = seatValidation.totalAmount();

        BigDecimal discount = BigDecimal.ZERO;
        Long voucherId = null;
        if (voucherCode != null && !voucherCode.isBlank()) {
            Voucher voucher = voucherRepository.findByCodeAndActiveTrue(voucherCode)
                .orElseThrow(() -> new CustomException("Invalid voucher", HttpStatus.BAD_REQUEST, "INVALID_VOUCHER"));
            validateVoucher(voucher, userId);
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

    private void validateVoucher(Voucher voucher, Long userId) {
        LocalDateTime now = LocalDateTime.now();
        if (voucher.getValidUntil() != null && now.isAfter(voucher.getValidUntil())) {
            throw new CustomException("Voucher expired", HttpStatus.BAD_REQUEST, "VOUCHER_EXPIRED");
        }
        if (voucher.getUsageLimit() != null && voucher.getUsedCount() >= voucher.getUsageLimit()) {
            throw new CustomException("Voucher exhausted", HttpStatus.BAD_REQUEST, "VOUCHER_EXHAUSTED");
        }
        
        // 1-use-per-user limit
        boolean alreadyUsed = orderRepository.existsByUserIdAndVoucherIdAndStatusIn(
                userId, 
                voucher.getId(), 
                List.of(Order.OrderStatus.PENDING, Order.OrderStatus.PAID)
        );
        if (alreadyUsed) {
            throw new CustomException("You have already used this voucher", HttpStatus.BAD_REQUEST, "VOUCHER_ALREADY_USED");
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
