package com.uit.cinema.recommendation.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record UserRatingRequest(
        @NotNull Long movieId,
        @NotNull @DecimalMin("1.0") @DecimalMax("5.0") Double ratingValue
) {
}
