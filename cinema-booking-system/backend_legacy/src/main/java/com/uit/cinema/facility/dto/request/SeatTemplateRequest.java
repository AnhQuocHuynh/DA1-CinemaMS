package com.uit.cinema.facility.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SeatTemplateRequest {
    @NotBlank(message = "Nhãn hàng không được để trống")
    private String rowLabel;

    @NotNull(message = "Số cột không được để trống")
    private Integer columnNumber;

    @NotBlank(message = "Loại ghế không được để trống")
    private String seatTypeCode;
}
