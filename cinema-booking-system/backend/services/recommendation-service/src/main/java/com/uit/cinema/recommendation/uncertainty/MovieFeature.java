package com.uit.cinema.recommendation.uncertainty;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record MovieFeature(
        Long id,
        String title,
        String posterUrl,
        Integer durationMinutes,
        Integer releaseYear,
        Double imdbRating,
        String region,
        String language,
        String genreCsv,
        String status,
        String imdbId
) {
}
