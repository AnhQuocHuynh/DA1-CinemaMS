package com.uit.cinema.recommendation.dto;

public record RatingPredictionResponse(
        Long userId,
        Long targetMovieId,
        Long nearestMovieId,
        double rawPrediction,
        double finalPrediction,
        double userMeanRating,
        double minDissimilarity,
        double uncertaintyScore,
        boolean thresholdApplied
) {
}
