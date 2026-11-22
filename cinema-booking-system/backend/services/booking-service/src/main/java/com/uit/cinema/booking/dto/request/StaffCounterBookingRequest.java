package com.uit.cinema.booking.dto.request;

import jakarta.validation.constraints.NotEmpty;
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
public class StaffCounterBookingRequest {
    @NotNull
    private Long showtimeId;
    @NotEmpty
    private List<Long> seatIds;
    private String customerName;
    private String customerPhone;
    private String paymentMethod;
    private String voucherCode;
    private Long userId;
}
