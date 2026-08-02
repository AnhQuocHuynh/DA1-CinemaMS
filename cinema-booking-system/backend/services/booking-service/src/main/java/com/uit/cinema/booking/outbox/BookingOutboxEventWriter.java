package com.uit.cinema.booking.outbox;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Review;
import com.uit.cinema.core.outbox.TransactionalOutbox;
import com.uit.cinema.showtime.service.contract.ShowtimeScheduleView;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class BookingOutboxEventWriter {

    private static final String SOURCE = "booking-service";
    private static final String EXCHANGE = "booking.events";

    private final TransactionalOutbox transactionalOutbox;

    public void orderPaid(Order order, ShowtimeScheduleView showtime, int ticketCount) {
        transactionalOutbox.append(
            SOURCE,
            EXCHANGE,
            "order.paid",
            "order",
            order.getId(),
            new OrderPaidPayload(
                order.getId(),
                order.getUserId(),
                order.getShowtimeId(),
                showtime.movieId(),
                showtime.eventId(),
                order.getTotalAmount(),
                order.getFinalAmount(),
                ticketCount,
                order.getPaymentMethod(),
                order.getPaymentTransactionId()
            )
        );
    }

    public void orderRefunded(Order order, int ticketCount) {
        transactionalOutbox.append(
            SOURCE,
            EXCHANGE,
            "order.refunded",
            "order",
            order.getId(),
            new OrderRefundedPayload(
                order.getId(),
                order.getUserId(),
                order.getShowtimeId(),
                order.getFinalAmount(),
                ticketCount
            )
        );
    }

    public void reviewCreated(Review review) {
        transactionalOutbox.append(
            SOURCE,
            EXCHANGE,
            "review.created",
            "review",
            review.getId(),
            new ReviewCreatedPayload(
                review.getId(),
                review.getUserId(),
                review.getMovieId(),
                review.getEventId(),
                review.getRating(),
                review.getStatus().name(),
                review.getCreatedAt()
            )
        );
    }

    private record OrderPaidPayload(
        Long orderId,
        Long userId,
        Long showtimeId,
        Long movieId,
        Long eventId,
        BigDecimal totalAmount,
        BigDecimal finalAmount,
        int ticketCount,
        String paymentMethod,
        String transactionId
    ) {
    }

    private record OrderRefundedPayload(
        Long orderId,
        Long userId,
        Long showtimeId,
        BigDecimal finalAmount,
        int ticketCount
    ) {
    }

    private record ReviewCreatedPayload(
        Long reviewId,
        Long userId,
        Long movieId,
        Long eventId,
        Integer rating,
        String status,
        LocalDateTime createdAt
    ) {
    }
}

