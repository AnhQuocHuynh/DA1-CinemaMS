package com.uit.cinema.catalog.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

import java.time.LocalDateTime;

@Data
public class EventRequest {
    @NotBlank(message = "Tên sự kiện không được để trống")
    private String name;

    private String description;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String venue;
    private String imageUrl;
    private boolean active = true;

    @NotNull(message = "Room ID không được để trống")
    private Long roomId;

    @NotNull(message = "Giá cơ bản không được để trống")
    private BigDecimal basePrice;
}
