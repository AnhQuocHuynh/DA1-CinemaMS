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
    private Long showtimeId;
    private Long seatTemplateId;
    private BigDecimal price;
    private String status;
    private Long holdTtlSeconds;
}
