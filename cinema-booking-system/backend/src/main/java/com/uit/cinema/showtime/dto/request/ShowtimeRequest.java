package com.uit.cinema.showtime.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class ShowtimeRequest {
    @NotNull(message = "Room ID không được để trống")
    private Long roomId;

    @NotNull(message = "Movie ID không được để trống")
    private Long movieId;

    private Long eventId;

    @NotNull(message = "Thời gian bắt đầu không được để trống")
    private LocalDateTime startTime;

    @NotNull(message = "Thời gian kết thúc không được để trống")
    private LocalDateTime endTime;

    @NotNull(message = "Giá cơ bản không được để trống")
    private BigDecimal basePrice;
}
