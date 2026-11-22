package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Voucher;
import com.uit.cinema.booking.outbox.BookingOutboxEventWriter;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.VoucherRepository;
import com.uit.cinema.booking.service.OrderService;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.core.exception.DuplicatePendingOrderException;
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
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private static final String SEATS_CHANGED_REASON = "SEATS_CHANGED";

    private final OrderRepository orderRepository;
    private final VoucherRepository voucherRepository;
    private final SeatReservationService seatReservationService;
    private final BookingOutboxEventWriter bookingOutboxEventWriter;

    @Override
    @Transactional
    public Order createOrder(Long userId, Long showtimeId, List<Long> seatIds, String voucherCode) {
        if (seatIds == null || seatIds.isEmpty()) {
            throw new CustomException("Seat list is empty", HttpStatus.BAD_REQUEST, "SEAT_LIST_EMPTY");
        }

        Optional<Order> existingPending = orderRepository.findByUserIdAndShowtimeIdAndStatus(
            userId, showtimeId, Order.OrderStatus.PENDING
        );
        if (existingPending.isPresent() && hasSameSeats(existingPending.get(), seatIds)) {
            // True retry for the very same seats: let the client resume the existing order.
            throw new DuplicatePendingOrderException(existingPending.get().getId());
        }

        SeatHoldValidationResult seatValidation = seatReservationService.validateHeldSeats(
            new SeatBookingRequest(userId, showtimeId, seatIds)
        );
        BigDecimal total = seatValidation.totalAmount();

        // The customer went back and picked different seats: the old pending order is stale.
        // Only supersede it after the new seats are validated so a failed validation leaves it untouched.
        existingPending.ifPresent(stale -> cancelSupersededOrder(stale, seatIds));

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
        bookingOutboxEventWriter.orderCreated(saved);
        log.info("Created order {} for user {} showtime {}", saved.getId(), userId, showtimeId);
        return saved;
    }

    @Override
    @Transactional(readOnly = true)
    public Order getOrderById(Long orderId) {
        return orderRepository.findById(orderId)
            .orElseThrow(() -> new CustomException("Order not found", HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND"));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Order> getOrdersByUserId(Long userId) {
        return orderRepository.findByUserIdOrderByCreatedAtDesc(userId);
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

    private Set<Long> parseSeatIds(String snapshot) {
        if (snapshot == null || snapshot.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(snapshot.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .map(Long::valueOf)
            .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private boolean hasSameSeats(Order order, List<Long> requestedSeatIds) {
        return parseSeatIds(order.getSeatIdsSnapshot()).equals(new HashSet<>(requestedSeatIds));
    }

    private void cancelSupersededOrder(Order stale, List<Long> newSeatIds) {
        stale.setStatus(Order.OrderStatus.CANCELLED);
        orderRepository.save(stale);
        restoreVoucherUsage(stale);
        bookingOutboxEventWriter.orderCancelled(stale.getId(), stale.getUserId(), SEATS_CHANGED_REASON);

        Set<Long> keptSeatIds = new HashSet<>(newSeatIds);
        for (Long staleSeatId : parseSeatIds(stale.getSeatIdsSnapshot())) {
            if (!keptSeatIds.contains(staleSeatId)) {
                releaseSeatIfStillHeldByUser(stale.getUserId(), stale.getShowtimeId(), staleSeatId);
            }
        }
        log.info("Cancelled superseded pending order {} for user {} showtime {} (seat selection changed)",
            stale.getId(), stale.getUserId(), stale.getShowtimeId());
    }

    private void restoreVoucherUsage(Order stale) {
        if (stale.getVoucherId() == null) {
            return;
        }
        voucherRepository.findById(stale.getVoucherId())
            .ifPresent(voucher -> voucher.setUsedCount(Math.max(0, voucher.getUsedCount() - 1)));
    }

    /**
     * Best effort: releases a seat of the superseded order only while it is still held by this user,
     * so a seat that was already released and re-held by somebody else is never touched.
     */
    private void releaseSeatIfStillHeldByUser(Long userId, Long showtimeId, Long seatId) {
        SeatBookingRequest singleSeat = new SeatBookingRequest(userId, showtimeId, List.of(seatId));
        try {
            seatReservationService.validateHeldSeats(singleSeat);
            seatReservationService.releaseHeldSeats(singleSeat);
        } catch (CustomException ex) {
            log.debug("Seat {} of superseded order not released: {}", seatId, ex.getErrorCode());
        }
    }
}
