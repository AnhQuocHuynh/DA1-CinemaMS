package com.uit.cinema.showtime.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class ShowtimeRequest {
    @NotNull(message = "Room ID is required")
    private Long roomId;

    private Long movieId;

    private Long eventId;

    @NotNull(message = "Start time is required")
    private LocalDateTime startTime;

    @NotNull(message = "End time is required")
    private LocalDateTime endTime;

    @NotNull(message = "Base price is required")
    private BigDecimal basePrice;
}
