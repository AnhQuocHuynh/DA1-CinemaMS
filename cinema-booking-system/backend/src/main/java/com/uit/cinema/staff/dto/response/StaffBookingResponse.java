package com.uit.cinema.staff.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class StaffBookingResponse {
    private String id;
    private String customer;
    private String customerName;
    private String movieTitle;
    private String time;
    private String showtime;
    private int seats;
    private String status;
}
