package com.uit.cinema.booking.dto.response;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Ticket;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class OrderResponse {
    private Long id;
    private Long userId;
    private Long showtimeId;
    private Long movieId;
    private String movieTitle;
    private Long roomId;
    private String roomName;
    private Long cinemaId;
    private String cinemaName;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private List<Long> seatIds;
    private List<String> seatLabels;
    private List<OrderSeatResponse> seats;
    private Long voucherId;
    private BigDecimal totalAmount;
    private BigDecimal discountAmount;
    private BigDecimal finalAmount;
    private Order.OrderStatus status;
    private String paymentMethod;
    private String paymentTransactionId;
    private List<OrderTicketResponse> tickets;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    @Builder
    public static class OrderSeatResponse {
        private Long seatId;
        private Long seatTemplateId;
        private String label;
        private String rowLabel;
        private Integer columnNumber;
        private String seatType;
        private String seatTypeCode;
        private String seatTypeName;
        private Integer columnSpan;
        private BigDecimal price;
    }

    @Data
    @Builder
    public static class OrderTicketResponse {
        private Long id;
        private Long showtimeSeatId;
        private String seatLabel;
        private String ticketCode;
        private String qrCodeData;
        private BigDecimal price;
        private Ticket.TicketStatus status;
        private LocalDateTime checkedInAt;
        private LocalDateTime createdAt;
    }
}
