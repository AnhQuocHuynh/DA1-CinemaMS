package com.uit.cinema.facility.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SeatTemplateResponse {
    private Long id;
    private String rowLabel;
    private Integer columnNumber;
    private String seatTypeCode;
    private Integer columnSpan;
    private boolean active;
}
