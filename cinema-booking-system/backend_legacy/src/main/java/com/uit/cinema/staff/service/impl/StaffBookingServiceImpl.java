package com.uit.cinema.staff.service.impl;

import com.uit.cinema.booking.dto.response.OrderResponse;
import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.entity.Voucher;
import com.uit.cinema.booking.mapper.OrderResponseMapper;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.VoucherRepository;
import com.uit.cinema.booking.service.TicketGenerationService;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.iam.entity.User;
import com.uit.cinema.iam.repository.UserRepository;
import com.uit.cinema.showtime.service.SeatReservationService;
import com.uit.cinema.showtime.service.contract.SeatBookingRequest;
import com.uit.cinema.showtime.service.contract.SeatBookingResult;
import com.uit.cinema.showtime.service.contract.SeatHoldValidationResult;
import com.uit.cinema.showtime.service.contract.SeatView;
import com.uit.cinema.showtime.service.contract.ShowtimeScheduleView;
import com.uit.cinema.staff.dto.request.StaffCounterBookingRequest;
import com.uit.cinema.staff.service.StaffBookingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StaffBookingServiceImpl implements StaffBookingService {

    private static final String WALK_IN_USER_EMAIL = "walkin@cinema.local";

    private final OrderRepository orderRepository;
    private final VoucherRepository voucherRepository;
    private final UserRepository userRepository;
    private final TicketGenerationService ticketGenerationService;
    private final OrderResponseMapper orderResponseMapper;
    private final SeatReservationService seatReservationService;

    @Override
    @Transactional
    public OrderResponse createCounterBooking(StaffCounterBookingRequest request, Long staffId) {
        validateRequest(request);
        ShowtimeScheduleView showtime = seatReservationService.getSchedule(request.getShowtimeId());
        validateShowtimeBookable(showtime);

        SeatHoldValidationResult seatValidation = seatReservationService.validateAvailableSeats(
            new SeatBookingRequest(staffId, showtime.showtimeId(), request.getSeatIds())
        );
        BigDecimal total = seatValidation.totalAmount();

        Voucher voucher = resolveVoucher(request.getVoucherCode());
        BigDecimal discount = voucher != null ? calculateDiscount(voucher, total) : BigDecimal.ZERO;
        BigDecimal finalAmount = total.subtract(discount);

        if (voucher != null) {
            voucher.setUsedCount(voucher.getUsedCount() + 1);
            voucherRepository.save(voucher);
        }

        User walkInUser = userRepository.findByEmail(WALK_IN_USER_EMAIL)
            .orElseThrow(() -> new CustomException("Walk-in user is not configured", HttpStatus.INTERNAL_SERVER_ERROR, "WALK_IN_USER_NOT_FOUND"));

        Order order = Order.builder()
            .userId(walkInUser.getId())
            .showtimeId(showtime.showtimeId())
            .seatIdsSnapshot(joinSeatIds(request.getSeatIds()))
            .voucherId(voucher != null ? voucher.getId() : null)
            .totalAmount(total)
            .discountAmount(discount)
            .finalAmount(finalAmount)
            .status(Order.OrderStatus.PAID)
            .salesChannel(Order.SalesChannel.COUNTER)
            .customerName(normalizeCustomerName(request.getCustomerName()))
            .customerPhone(normalizeBlank(request.getCustomerPhone()))
            .createdByStaffId(staffId)
            .paymentMethod(normalizePaymentMethod(request.getPaymentMethod()))
            .paymentTransactionId("COUNTER-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
            .build();

        Order savedOrder = orderRepository.save(order);
        SeatBookingResult bookingResult = seatReservationService.bookAvailableSeats(
            new SeatBookingRequest(staffId, showtime.showtimeId(), request.getSeatIds())
        );
        Map<Long, SeatView> seatsById = bookingResult.seats().stream()
            .collect(Collectors.toMap(SeatView::seatId, Function.identity()));

        for (Long seatId : request.getSeatIds()) {
            SeatView seat = seatsById.get(seatId);
            Ticket ticket = Ticket.builder()
                .order(savedOrder)
                .showtimeSeatId(seatId)
                .price(seat != null ? seat.price() : BigDecimal.ZERO)
                .status(Ticket.TicketStatus.VALID)
                .build();
            ticketGenerationService.generateTicket(ticket);
        }

        return orderResponseMapper.toResponse(orderRepository.save(savedOrder));
    }

    private void validateRequest(StaffCounterBookingRequest request) {
        if (request == null || request.getShowtimeId() == null) {
            throw new CustomException("Showtime is required", HttpStatus.BAD_REQUEST, "SHOWTIME_REQUIRED");
        }
        if (request.getSeatIds() == null || request.getSeatIds().isEmpty()) {
            throw new CustomException("Seat list is empty", HttpStatus.BAD_REQUEST, "SEAT_LIST_EMPTY");
        }
    }

    private void validateShowtimeBookable(ShowtimeScheduleView showtime) {
        if ("CANCELLED".equals(showtime.status()) || "ENDED".equals(showtime.status())) {
            throw new CustomException("Showtime is not bookable", HttpStatus.BAD_REQUEST, "SHOWTIME_NOT_BOOKABLE");
        }
        if (showtime.endTime() != null && !showtime.endTime().isAfter(LocalDateTime.now())) {
            throw new CustomException("Showtime has ended", HttpStatus.BAD_REQUEST, "SHOWTIME_ENDED");
        }
    }

    private Voucher resolveVoucher(String voucherCode) {
        if (voucherCode == null || voucherCode.isBlank()) {
            return null;
        }
        Voucher voucher = voucherRepository.findByCodeAndActiveTrue(voucherCode.trim())
            .orElseThrow(() -> new CustomException("Invalid voucher", HttpStatus.BAD_REQUEST, "INVALID_VOUCHER"));
        validateVoucher(voucher);
        return voucher;
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

    private String normalizeCustomerName(String customerName) {
        String normalized = normalizeBlank(customerName);
        return normalized != null ? normalized : "Walk-in Customer";
    }

    private String normalizePaymentMethod(String paymentMethod) {
        String normalized = normalizeBlank(paymentMethod);
        return normalized != null ? normalized.toUpperCase() : "CASH";
    }

    private String normalizeBlank(String value) {
        return value != null && !value.isBlank() ? value.trim() : null;
    }
}
