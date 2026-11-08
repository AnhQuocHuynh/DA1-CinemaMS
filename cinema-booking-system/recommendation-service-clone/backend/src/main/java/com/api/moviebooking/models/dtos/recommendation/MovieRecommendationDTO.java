package com.api.moviebooking.models.dtos.recommendation;

import java.util.UUID;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MovieRecommendationDTO {

    private UUID movieId;
    private String title;
    private String posterUrl;

    private Double predictedRating;
    private Double uncertaintyScore;
    // nearest neighbor (explainability) - optional
    private UUID nearestMovieId;
    private String nearestMovieTitle;
    private String nearestMoviePosterUrl;
}
