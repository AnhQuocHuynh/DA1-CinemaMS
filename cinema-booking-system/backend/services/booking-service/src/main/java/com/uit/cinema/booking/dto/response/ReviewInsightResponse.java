package com.uit.cinema.booking.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ReviewInsightResponse {
    private Long movieId;
    private Long eventId;
    private long totalReviews;
    private double averageRating;
    private long oneStarCount;
    private long twoStarCount;
    private long threeStarCount;
    private long fourStarCount;
    private long fiveStarCount;
}
