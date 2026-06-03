package com.uit.cinema.showtime.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShowtimeSeatResponse {
    private Long id;
    private String seatId;
    private Long showtimeId;
    private Long seatTemplateId;
    private String label;
    private String rowLabel;
    private Integer columnNumber;
    private String seatType;
    private Boolean isPathway;
    private BigDecimal price;
    private String status;
    private Long holdTtlSeconds;
}
