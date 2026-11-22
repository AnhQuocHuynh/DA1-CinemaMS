package com.uit.cinema.booking.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffBookingListItemResponse {
    private String id;
    private String customer;
    private String customerName;
    private String movieTitle;
    private String time;
    private String showtime;
    private int seats;
    private String status;
}
