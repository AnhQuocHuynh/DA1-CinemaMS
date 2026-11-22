package com.api.moviebooking.models.dtos.recommendation;

import java.util.UUID;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RatingPredictionDTO {

    private UUID userId;
    private UUID targetMovieId;
    private UUID nearestMovieId;

    private Double rawPrediction;
    private Double finalPrediction;
    private Double userMeanRating;

    private Double minDissimilarity;
    private Double uncertaintyScore;
    private Boolean thresholdApplied;
}
