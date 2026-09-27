package com.uit.cinema.staff.dto.request;

import lombok.Data;

import java.util.List;

@Data
public class StaffCounterBookingRequest {
    private Long showtimeId;
    private List<Long> seatIds;
    private String customerName;
    private String customerPhone;
    private String paymentMethod;
    private String voucherCode;
}
