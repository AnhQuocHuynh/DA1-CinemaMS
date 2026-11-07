package com.uit.cinema.booking.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffBookingValidationResponse {
    private String id;
    private String customerName;
    private String movieTitle;
    private String showtime;
    private String status;
}
