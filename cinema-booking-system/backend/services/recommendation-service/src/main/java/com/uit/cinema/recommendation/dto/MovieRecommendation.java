package com.uit.cinema.recommendation.dto;

import java.math.BigDecimal;
import java.util.List;

public record MovieRecommendation(
    Long movieId,
    String title,
    String posterUrl,
    BigDecimal relevanceScore,
    String reason,
    List<String> matchedGenres,
    BigDecimal avgRating,
    long bookingCount
) {
}
