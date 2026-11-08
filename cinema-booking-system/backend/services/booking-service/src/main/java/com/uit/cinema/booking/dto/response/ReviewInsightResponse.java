package com.uit.cinema.booking.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

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
    private String aiSummary;
    @Builder.Default
    private List<String> keywords = List.of();
}
