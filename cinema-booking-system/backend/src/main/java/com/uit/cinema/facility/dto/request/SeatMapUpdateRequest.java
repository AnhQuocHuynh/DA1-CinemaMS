package com.uit.cinema.facility.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SeatMapUpdateRequest {
    @NotNull(message = "Số hàng không được để trống")
    @Min(value = 1, message = "Số hàng tối thiểu là 1")
    private Integer rows;

    @NotNull(message = "Số cột không được để trống")
    @Min(value = 1, message = "Số cột tối thiểu là 1")
    private Integer columns;

    @Valid
    private List<SeatTemplateRequest> seats;
}
