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
    private Long showtimeId;
    private Long movieId;
    private String movieTitle;
    private Long eventId;
    private String eventTitle;
    private String displayTitle;
    private String displayType;
    private Long roomId;
    private String roomName;
    private Long cinemaId;
    private String cinemaName;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Long showtimeSeatId;
    private Long seatTemplateId;
    private String seatLabel;
    private String rowLabel;
    private Integer columnNumber;
    private String seatType;
    private String seatTypeCode;
    private String seatTypeName;
    private Integer columnSpan;
    private String ticketCode;
    private String qrCodeData;
    private BigDecimal price;
    private Ticket.TicketStatus status;
    private LocalDateTime checkedInAt;
    private LocalDateTime createdAt;
    private Boolean refundable;
    private Integer refundPercent;
}
