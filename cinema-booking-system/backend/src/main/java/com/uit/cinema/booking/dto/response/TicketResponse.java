package com.uit.cinema.booking.dto.response;

import com.uit.cinema.booking.entity.Ticket;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class TicketResponse {
    private Long id;
    private Long orderId;
    private Long userId;
    private Long showtimeSeatId;
    private String ticketCode;
    private String qrCodeData;
    private BigDecimal price;
    private Ticket.TicketStatus status;
    private LocalDateTime checkedInAt;
    private LocalDateTime createdAt;
    private Boolean refundable;
    private Integer refundPercent;
}
