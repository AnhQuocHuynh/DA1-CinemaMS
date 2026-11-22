package com.uit.cinema.recommendation.dto;

public record MovieRecommendationResponse(
        Long movieId,
        String title,
        String posterUrl,
        double predictedRating,
        double uncertaintyScore,
        Long nearestMovieId,
        String nearestMovieTitle,
        String nearestMoviePosterUrl
) {
}
