package com.uit.cinema.recommendation.dto;

import java.time.LocalDateTime;

public record UserRatingResponse(
        Long ratingId,
        Long movieId,
        String movieTitle,
        String posterUrl,
        Double ratingValue,
        LocalDateTime createdAt
) {
}
