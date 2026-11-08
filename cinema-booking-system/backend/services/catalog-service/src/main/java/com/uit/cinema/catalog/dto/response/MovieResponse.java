package com.uit.cinema.catalog.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MovieResponse {
    private Long id;
    private String title;
    private String description;
    private String aiSummary;
    private Integer durationMinutes;
    private LocalDate releaseDate;
    private String ageRating;
    private String posterUrl;
    private String trailerUrl;
    private String language;
    private String imdbId;
    private Double imdbRating;
    private String region;
    private String director;
    private String actors;
    private boolean active;
    private List<String> genres;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
