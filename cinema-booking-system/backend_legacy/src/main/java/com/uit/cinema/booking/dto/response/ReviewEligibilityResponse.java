package com.uit.cinema.booking.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ReviewEligibilityResponse {
    private Long userId;
    private Long movieId;
    private Long eventId;
    private Boolean eligible;
    private Boolean hasReviewed;
    private Boolean hasPaidTicket;
    private Boolean watched;
    private String reasonCode;
    private String message;
}
