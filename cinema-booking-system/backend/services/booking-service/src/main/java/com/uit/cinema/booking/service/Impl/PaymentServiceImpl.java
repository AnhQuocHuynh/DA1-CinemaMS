package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.outbox.BookingOutboxEventWriter;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.booking.service.PaymentService;
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

import java.time.Duration;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentServiceImpl implements PaymentService {

    private final OrderRepository orderRepository;
    private final TicketRepository ticketRepository;
    private final TicketGenerationService ticketGenerationService;
    private final SeatReservationService seatReservationService;
    private final BookingOutboxEventWriter bookingOutboxEventWriter;

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
        ShowtimeScheduleView showtime = seatReservationService.getSchedule(order.getShowtimeId());
        SeatBookingResult bookingResult = seatReservationService.confirmHeldSeats(
            new SeatBookingRequest(order.getUserId(), order.getShowtimeId(), seatIds)
        );
        Map<Long, SeatView> seatsById = bookingResult.seats().stream()
            .collect(Collectors.toMap(SeatView::seatId, Function.identity()));

        for (Long seatId : seatIds) {
            SeatView seat = seatsById.get(seatId);
            Ticket ticket = Ticket.builder()
                .order(order)
                .showtimeSeatId(seatId)
                .price(seat != null ? seat.price() : BigDecimal.ZERO)
                .status(Ticket.TicketStatus.VALID)
                .build();
            ticketGenerationService.generateTicket(ticket);
        }

        order.setPaymentMethod(paymentMethod);
        order.setPaymentTransactionId(transactionId);
        order.setStatus(Order.OrderStatus.PAID);
        log.info("Order {} paid via {}, txn {}", orderId, paymentMethod, transactionId);
        Order paidOrder = orderRepository.save(order);
        bookingOutboxEventWriter.orderPaid(paidOrder, showtime, seatIds.size());
        return paidOrder;
    }

    @Override
    @Transactional
    public Order refund(Long orderId, String reason) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new CustomException("Order not found", HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND"));
        if (order.getStatus() != Order.OrderStatus.PAID) {
            throw new CustomException("Only paid order can be refunded", HttpStatus.BAD_REQUEST, "INVALID_ORDER_STATUS");
        }

        ShowtimeScheduleView showtime = seatReservationService.getSchedule(order.getShowtimeId());
        int refundPercent = calculateRefundPercent(showtime.startTime(), LocalDateTime.now());
        if (refundPercent == 0) {
            throw new CustomException("Refund window has closed", HttpStatus.BAD_REQUEST, "REFUND_WINDOW_CLOSED");
        }

        List<Ticket> tickets = ticketRepository.findByOrderIdOrderByCreatedAtDesc(order.getId());
        for (Ticket ticket : tickets) {
            if (ticket.getStatus() == Ticket.TicketStatus.CHECKED_IN) {
                throw new CustomException("Checked-in ticket cannot be refunded", HttpStatus.BAD_REQUEST, "TICKET_ALREADY_CHECKED_IN");
            }
        }

        for (Ticket ticket : tickets) {
            ticket.setStatus(Ticket.TicketStatus.REFUNDED);
            ticketRepository.save(ticket);
        }
        List<Long> refundedSeatIds = tickets.stream().map(Ticket::getShowtimeSeatId).toList();
        if (!refundedSeatIds.isEmpty()) {
            seatReservationService.releaseBookedSeats(new SeatReleaseRequest(order.getShowtimeId(), refundedSeatIds));
        }

        order.setStatus(Order.OrderStatus.REFUNDED);
        log.info("Order {} refunded ({}%). Reason: {}", orderId, refundPercent, reason);
        Order refundedOrder = orderRepository.save(order);
        bookingOutboxEventWriter.orderRefunded(refundedOrder, tickets.size());
        return refundedOrder;
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
