package com.uit.cinema.showtime.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShowtimeResponse {
    private Long id;
    private Long roomId;
    private Long movieId;
    private Long eventId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private BigDecimal basePrice;
    private String status;
    private LocalDateTime createdAt;
    private String roomName;
    private Long cinemaId;
    private String cinemaName;
}
