package com.api.moviebooking.models.dtos.recommendation;

import java.util.UUID;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UserRatingRequestDTO {

    @NotNull
    private UUID movieId;

    @NotNull
    @DecimalMin("1.0")
    @DecimalMax("5.0")
    private Double ratingValue;
}
