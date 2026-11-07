package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.dto.request.StaffCounterBookingRequest;
import com.uit.cinema.booking.dto.response.OrderResponse;
import com.uit.cinema.booking.dto.response.StaffBookingListItemResponse;
import com.uit.cinema.booking.dto.response.StaffBookingValidationResponse;
import com.uit.cinema.booking.dto.response.StaffDashboardSummaryResponse;
import com.uit.cinema.booking.dto.response.StaffValidationStatsResponse;
import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.entity.Voucher;
import com.uit.cinema.booking.mapper.OrderResponseMapper;
import com.uit.cinema.booking.outbox.BookingOutboxEventWriter;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.booking.repository.VoucherRepository;
import com.uit.cinema.booking.service.StaffBookingService;
import com.uit.cinema.booking.service.TicketGenerationService;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.service.SeatReservationService;
import com.uit.cinema.showtime.service.contract.SeatBookingRequest;
import com.uit.cinema.showtime.service.contract.SeatBookingResult;
import com.uit.cinema.showtime.service.contract.SeatReleaseRequest;
import com.uit.cinema.showtime.service.contract.SeatView;
import com.uit.cinema.showtime.service.contract.ShowtimeScheduleView;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class StaffBookingServiceImpl implements StaffBookingService {

    private final OrderRepository orderRepository;
    private final TicketRepository ticketRepository;
    private final VoucherRepository voucherRepository;
    private final SeatReservationService seatReservationService;
    private final TicketGenerationService ticketGenerationService;
    private final BookingOutboxEventWriter bookingOutboxEventWriter;
    private final OrderResponseMapper orderResponseMapper;

    @Override
    @Transactional
    public OrderResponse createCounterBooking(StaffCounterBookingRequest request, Long staffId) {
        if (request.getSeatIds() == null || request.getSeatIds().isEmpty()) {
            throw new CustomException("Seat list is empty", HttpStatus.BAD_REQUEST, "SEAT_LIST_EMPTY");
        }

        Long userId = (request.getUserId() != null && request.getUserId() > 0)
                ? request.getUserId()
                : Order.ANONYMOUS_USER_ID;

        ShowtimeScheduleView showtime = seatReservationService.getSchedule(request.getShowtimeId());

        SeatBookingResult bookingResult = seatReservationService.bookAvailableSeats(
                new SeatBookingRequest(userId, request.getShowtimeId(), request.getSeatIds())
        );

        try {
            BigDecimal total = bookingResult.seats().stream()
                    .map(SeatView::price)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal discount = BigDecimal.ZERO;
            Long voucherId = null;
            String voucherCode = request.getVoucherCode();
            if (voucherCode != null && !voucherCode.isBlank()) {
                Voucher voucher = voucherRepository.findByCodeAndActiveTrue(voucherCode)
                        .orElseThrow(() -> new CustomException("Invalid voucher", HttpStatus.BAD_REQUEST, "INVALID_VOUCHER"));
                validateVoucher(voucher, userId);
                discount = calculateDiscount(voucher, total);
                voucher.setUsedCount(voucher.getUsedCount() + 1);
                voucherId = voucher.getId();
            }

            BigDecimal finalAmount = total.subtract(discount).max(BigDecimal.ZERO);
            String paymentMethod = (request.getPaymentMethod() != null && !request.getPaymentMethod().isBlank())
                    ? request.getPaymentMethod().toUpperCase()
                    : "CASH";

            Order order = Order.builder()
                    .userId(userId)
                    .showtimeId(request.getShowtimeId())
                    .customerName(request.getCustomerName())
                    .customerPhone(request.getCustomerPhone())
                    .salesChannel(Order.SalesChannel.COUNTER)
                    .createdByStaffId(staffId)
                    .seatIdsSnapshot(joinSeatIds(request.getSeatIds()))
                    .voucherId(voucherId)
                    .totalAmount(total)
                    .discountAmount(discount)
                    .finalAmount(finalAmount)
                    .status(Order.OrderStatus.PAID)
                    .paymentMethod(paymentMethod)
                    .paymentTransactionId("COUNTER-" + UUID.randomUUID())
                    .build();

            Order savedOrder = orderRepository.save(order);

            Map<Long, SeatView> seatsById = bookingResult.seats().stream()
                    .collect(Collectors.toMap(SeatView::seatId, Function.identity(), (a, b) -> a));

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

            bookingOutboxEventWriter.orderPaid(savedOrder, showtime, request.getSeatIds().size());
            log.info("Staff {} created counter order {} for showtime {}, total: {}",
                    staffId, savedOrder.getId(), request.getShowtimeId(), finalAmount);

            return orderResponseMapper.toResponse(savedOrder);
        } catch (RuntimeException ex) {
            log.error("Counter booking failed, compensating booked seats for showtime {}: {}",
                    request.getShowtimeId(), ex.getMessage(), ex);
            try {
                seatReservationService.releaseBookedSeats(
                        new SeatReleaseRequest(request.getShowtimeId(), request.getSeatIds())
                );
            } catch (Exception releaseEx) {
                log.error("Failed to release booked seats during compensation: {}", releaseEx.getMessage(), releaseEx);
            }
            throw ex;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public StaffDashboardSummaryResponse getStaffDashboardSummary() {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(LocalTime.MAX);

        long todayBookings = orderRepository.countByCreatedAtBetween(startOfDay, endOfDay);
        long totalTicketsSold = ticketRepository.countByCreatedAtBetween(startOfDay, endOfDay);

        List<Order> todayOrders = orderRepository.findByCreatedAtBetweenOrderByCreatedAtDesc(startOfDay, endOfDay);
        Map<Integer, Long> hourCounts = todayOrders.stream()
                .filter(o -> o.getCreatedAt() != null)
                .collect(Collectors.groupingBy(o -> o.getCreatedAt().getHour(), Collectors.counting()));

        String peakHour = hourCounts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(e -> String.format("%02d:00 - %02d:00", e.getKey(), (e.getKey() + 1) % 24))
                .orElse("N/A");

        return StaffDashboardSummaryResponse.builder()
                .todayBookings(todayBookings)
                .totalTicketsSold(totalTicketsSold)
                .peakHour(peakHour)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<StaffBookingListItemResponse> getTodayBookings(int limit) {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(LocalTime.MAX);

        List<Order> todayOrders = orderRepository.findByCreatedAtBetweenOrderByCreatedAtDesc(startOfDay, endOfDay);

        return todayOrders.stream()
                .limit(limit > 0 ? limit : 10)
                .map(order -> {
                    OrderResponse orderRes = orderResponseMapper.toResponse(order);
                    String customer = (order.getCustomerName() != null && !order.getCustomerName().isBlank())
                            ? order.getCustomerName()
                            : (order.getUserId() != null && order.getUserId() > 0 ? "Customer #" + order.getUserId() : "Walk-in Guest");
                    String time = order.getCreatedAt() != null
                            ? order.getCreatedAt().format(DateTimeFormatter.ofPattern("HH:mm"))
                            : "";
                    String showtimeStr = orderRes.getStartTime() != null
                            ? orderRes.getStartTime().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
                            : "N/A";
                    String status = switch (order.getStatus()) {
                        case PAID -> "confirmed";
                        case PENDING -> "pending";
                        default -> "cancelled";
                    };
                    return StaffBookingListItemResponse.builder()
                            .id("#BK-" + order.getId())
                            .customer(customer)
                            .customerName(customer)
                            .movieTitle(orderRes.getDisplayTitle() != null ? orderRes.getDisplayTitle() : "Movie #" + order.getShowtimeId())
                            .time(time)
                            .showtime(showtimeStr)
                            .seats(orderRes.getSeatIds() != null ? orderRes.getSeatIds().size() : 0)
                            .status(status)
                            .build();
                })
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public StaffValidationStatsResponse getValidationStats() {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(LocalTime.MAX);

        long totalValidated = ticketRepository.countByCreatedAtBetweenAndStatus(startOfDay, endOfDay, Ticket.TicketStatus.CHECKED_IN);
        long totalBookings = orderRepository.countByCreatedAtBetween(startOfDay, endOfDay);
        long pendingCheckIns = ticketRepository.countByCreatedAtBetweenAndStatus(startOfDay, endOfDay, Ticket.TicketStatus.VALID);

        return StaffValidationStatsResponse.builder()
                .totalValidated(totalValidated)
                .pendingCheckIns(pendingCheckIns)
                .totalBookings(totalBookings)
                .validatorsOnline(1)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<StaffBookingValidationResponse> getValidationBookings(int limit) {
        List<Order> paidOrders = orderRepository.findByStatusOrderByCreatedAtDesc(Order.OrderStatus.PAID);

        return paidOrders.stream()
                .limit(limit > 0 ? limit : 20)
                .map(order -> {
                    OrderResponse orderRes = orderResponseMapper.toResponse(order);
                    String customer = (order.getCustomerName() != null && !order.getCustomerName().isBlank())
                            ? order.getCustomerName()
                            : (order.getUserId() != null && order.getUserId() > 0 ? "Customer #" + order.getUserId() : "Walk-in Guest");
                    String showtimeStr = orderRes.getStartTime() != null
                            ? orderRes.getStartTime().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
                            : "N/A";
                    boolean hasPendingTickets = order.getTickets() == null || order.getTickets().isEmpty()
                            || order.getTickets().stream().anyMatch(ticket -> ticket.getStatus() == Ticket.TicketStatus.VALID);
                    String status = hasPendingTickets ? "pending" : "validated";
                    return StaffBookingValidationResponse.builder()
                            .id("#BK-" + order.getId())
                            .customerName(customer)
                            .movieTitle(orderRes.getDisplayTitle() != null ? orderRes.getDisplayTitle() : "Showtime #" + order.getShowtimeId())
                            .showtime(showtimeStr)
                            .status(status)
                            .build();
                })
                .toList();
    }

    private void validateVoucher(Voucher voucher, Long userId) {
        LocalDateTime now = LocalDateTime.now();
        if (voucher.getValidUntil() != null && now.isAfter(voucher.getValidUntil())) {
            throw new CustomException("Voucher expired", HttpStatus.BAD_REQUEST, "VOUCHER_EXPIRED");
        }
        if (voucher.getUsageLimit() != null && voucher.getUsedCount() >= voucher.getUsageLimit()) {
            throw new CustomException("Voucher exhausted", HttpStatus.BAD_REQUEST, "VOUCHER_EXHAUSTED");
        }

        if (userId != null && !userId.equals(Order.ANONYMOUS_USER_ID)) {
            boolean alreadyUsed = orderRepository.existsByUserIdAndVoucherIdAndStatusIn(
                    userId,
                    voucher.getId(),
                    List.of(Order.OrderStatus.PENDING, Order.OrderStatus.PAID)
            );
            if (alreadyUsed) {
                throw new CustomException("You have already used this voucher", HttpStatus.BAD_REQUEST, "VOUCHER_ALREADY_USED");
            }
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
