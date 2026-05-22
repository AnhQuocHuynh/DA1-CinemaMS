package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.entity.Voucher;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.VoucherRepository;
import com.uit.cinema.booking.service.OrderService;
import com.uit.cinema.booking.service.TicketGenerationService;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.service.SeatReservationService;
import com.uit.cinema.showtime.service.contract.SeatBookingRequest;
import com.uit.cinema.showtime.service.contract.SeatView;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final OrderRepository orderRepository;
    private final VoucherRepository voucherRepository;
    private final SeatReservationService seatReservationService;
    private final TicketGenerationService ticketGenerationService;

    /**
     * Tạo đơn hàng và vé trong một transaction để đảm bảo tính toàn vẹn dữ liệu.
     */
    @Override
    @Transactional
    public Order createOrder(Long userId, Long showtimeId, List<Long> seatIds, String voucherCode) {
        SeatBookingRequest seatRequest = new SeatBookingRequest(userId, showtimeId, seatIds);
        var validationResult = seatReservationService.validateHeldSeats(seatRequest);
        BigDecimal total = validationResult.totalAmount();

        BigDecimal discount = BigDecimal.ZERO;
        Long voucherId = null;
        if (voucherCode != null && !voucherCode.isBlank()) {
            Voucher voucher = voucherRepository.findByCodeAndActiveTrue(voucherCode)
                .orElseThrow(() -> new CustomException("Mã giảm giá không hợp lệ", HttpStatus.BAD_REQUEST, "INVALID_VOUCHER"));
            validateVoucher(voucher);
            discount = calculateDiscount(voucher, total);
            voucher.setUsedCount(voucher.getUsedCount() + 1);
            voucherId = voucher.getId();
        }

        BigDecimal finalAmount = total.subtract(discount);
        Order order = Order.builder()
            .userId(userId)
            .voucherId(voucherId)
            .totalAmount(total)
            .discountAmount(discount)
            .finalAmount(finalAmount)
            .build();
        Order saved = orderRepository.save(order);

        seatReservationService.confirmHeldSeats(seatRequest);

        for (SeatView seat : validationResult.seats()) {
            Ticket ticket = Ticket.builder()
                .order(saved)
                .showtimeSeatId(seat.seatId())
                .price(seat.price())
                .build();
            ticketGenerationService.generateTicket(ticket);
        }

        log.info("Order {} created for user {} — {} seats, final: {}", saved.getId(), userId, seatIds.size(), finalAmount);
        return saved;
    }

    private void validateVoucher(Voucher voucher) {
        LocalDateTime now = LocalDateTime.now();
        if (voucher.getValidUntil() != null && now.isAfter(voucher.getValidUntil())) {
            throw new CustomException("Mã giảm giá đã hết hạn", HttpStatus.BAD_REQUEST, "VOUCHER_EXPIRED");
        }
        if (voucher.getUsageLimit() != null && voucher.getUsedCount() >= voucher.getUsageLimit()) {
            throw new CustomException("Mã giảm giá đã hết lượt sử dụng", HttpStatus.BAD_REQUEST, "VOUCHER_EXHAUSTED");
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
}
