package com.uit.cinema.catalog.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MovieFeatureResponse {
    private Long id;
    private String title;
    private String posterUrl;
    private Integer durationMinutes;
    private Integer releaseYear;
    private Double imdbRating;
    private String region;
    private String language;
    private String genreCsv;
    private String status;
    private String imdbId;
}
