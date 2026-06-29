package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.booking.service.PaymentService;
import com.uit.cinema.booking.service.TicketGenerationService;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.entity.Showtime;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.repository.ShowtimeRepository;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import com.uit.cinema.showtime.service.SeatHoldPolicy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentServiceImpl implements PaymentService {

    private final OrderRepository orderRepository;
    private final ShowtimeSeatRepository showtimeSeatRepository;
    private final ShowtimeRepository showtimeRepository;
    private final TicketRepository ticketRepository;
    private final TicketGenerationService ticketGenerationService;
    private final RedisTemplate<String, Object> redisTemplate;

    @Override
    @Transactional
    public Order processPayment(Long orderId, String paymentMethod, String transactionId) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new CustomException("Order not found", HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND"));

        if (transactionId != null && !transactionId.isBlank()) {
            Order existingTxn = orderRepository.findByPaymentTransactionId(transactionId).orElse(null);
            if (existingTxn != null && existingTxn.getId().equals(orderId) && existingTxn.getStatus() == Order.OrderStatus.PAID) {
                return existingTxn;
            }
            if (existingTxn != null && !existingTxn.getId().equals(orderId)) {
                throw new CustomException("Duplicate transaction id", HttpStatus.CONFLICT, "DUPLICATE_TRANSACTION");
            }
        }

        if (order.getStatus() != Order.OrderStatus.PENDING) {
            throw new CustomException("Order is not pending", HttpStatus.BAD_REQUEST, "INVALID_ORDER_STATUS");
        }

        List<Long> seatIds = parseSeatIds(order.getSeatIdsSnapshot());
        for (Long seatId : seatIds) {
            ShowtimeSeat seat = showtimeSeatRepository.findById(seatId)
                .orElseThrow(() -> new CustomException("Seat not found", HttpStatus.NOT_FOUND, "SEAT_NOT_FOUND"));
            if (!order.getShowtimeId().equals(seat.getShowtimeId())) {
                throw new CustomException("Seat-showtime mismatch", HttpStatus.BAD_REQUEST, "SEAT_SHOWTIME_MISMATCH");
            }
            if (seat.getStatus() != ShowtimeSeat.SeatStatus.HELD) {
                throw new CustomException("Seat hold expired", HttpStatus.CONFLICT, "SEAT_HOLD_EXPIRED");
            }
            Object holder = redisTemplate.opsForValue().get(SeatHoldPolicy.holdKey(order.getShowtimeId(), seatId));
            if (holder == null || !String.valueOf(order.getUserId()).equals(String.valueOf(holder))) {
                throw new CustomException("Seat hold owner mismatch", HttpStatus.CONFLICT, "SEAT_HOLD_OWNER_MISMATCH");
            }
        }

        for (Long seatId : seatIds) {
            ShowtimeSeat seat = showtimeSeatRepository.findById(seatId).orElseThrow();
            seat.setStatus(ShowtimeSeat.SeatStatus.BOOKED);
            showtimeSeatRepository.save(seat);

            Ticket ticket = Ticket.builder()
                .order(order)
                .showtimeSeatId(seatId)
                .price(seat.getPrice())
                .status(Ticket.TicketStatus.VALID)
                .build();
            ticketGenerationService.generateTicket(ticket);
            redisTemplate.delete(SeatHoldPolicy.holdKey(order.getShowtimeId(), seatId));
        }

        order.setPaymentMethod(paymentMethod);
        order.setPaymentTransactionId(transactionId);
        order.setStatus(Order.OrderStatus.PAID);
        log.info("Order {} paid via {}, txn {}", orderId, paymentMethod, transactionId);
        return orderRepository.save(order);
    }

    @Override
    @Transactional
    public Order refund(Long orderId, String reason) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new CustomException("Order not found", HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND"));
        if (order.getStatus() != Order.OrderStatus.PAID) {
            throw new CustomException("Only paid order can be refunded", HttpStatus.BAD_REQUEST, "INVALID_ORDER_STATUS");
        }

        Showtime showtime = showtimeRepository.findById(order.getShowtimeId())
            .orElseThrow(() -> new CustomException("Showtime not found", HttpStatus.NOT_FOUND, "SHOWTIME_NOT_FOUND"));
        int refundPercent = calculateRefundPercent(showtime.getStartTime(), LocalDateTime.now());
        if (refundPercent == 0) {
            throw new CustomException("Refund window has closed", HttpStatus.BAD_REQUEST, "REFUND_WINDOW_CLOSED");
        }

        List<Ticket> tickets = ticketRepository.findByOrderIdOrderByCreatedAtDesc(order.getId());
        for (Ticket ticket : tickets) {
            if (ticket.getStatus() == Ticket.TicketStatus.CHECKED_IN) {
                throw new CustomException("Checked-in ticket cannot be refunded", HttpStatus.BAD_REQUEST, "TICKET_ALREADY_CHECKED_IN");
            }
            ticket.setStatus(Ticket.TicketStatus.REFUNDED);
            ticketRepository.save(ticket);

            ShowtimeSeat seat = showtimeSeatRepository.findById(ticket.getShowtimeSeatId()).orElse(null);
            if (seat != null) {
                seat.setStatus(ShowtimeSeat.SeatStatus.AVAILABLE);
                showtimeSeatRepository.save(seat);
            }
        }

        order.setStatus(Order.OrderStatus.REFUNDED);
        log.info("Order {} refunded ({}%). Reason: {}", orderId, refundPercent, reason);
        return orderRepository.save(order);
    }

    private List<Long> parseSeatIds(String snapshot) {
        if (snapshot == null || snapshot.isBlank()) {
            throw new CustomException("Order has no seat snapshot", HttpStatus.BAD_REQUEST, "ORDER_SEAT_SNAPSHOT_EMPTY");
        }
        return List.of(snapshot.split(",")).stream()
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .map(Long::valueOf)
            .toList();
    }

    private int calculateRefundPercent(LocalDateTime showtimeStart, LocalDateTime now) {
        long hoursToShowtime = Duration.between(now, showtimeStart).toHours();
        if (hoursToShowtime > 24) {
            return 100;
        }
        if (hoursToShowtime >= 4) {
            return 50;
        }
        return 0;
    }
}
