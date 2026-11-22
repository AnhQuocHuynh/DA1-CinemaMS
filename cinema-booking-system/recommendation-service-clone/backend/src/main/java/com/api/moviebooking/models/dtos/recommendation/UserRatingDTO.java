package com.api.moviebooking.models.dtos.recommendation;

import java.time.LocalDateTime;
import java.util.UUID;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UserRatingDTO {

    private UUID ratingId;
    private UUID movieId;
    private String movieTitle;
    private String posterUrl;

    private Double ratingValue;
    private LocalDateTime createdAt;
}
