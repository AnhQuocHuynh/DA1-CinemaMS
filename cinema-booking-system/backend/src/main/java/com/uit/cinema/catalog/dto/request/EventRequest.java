package com.uit.cinema.catalog.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

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
}
