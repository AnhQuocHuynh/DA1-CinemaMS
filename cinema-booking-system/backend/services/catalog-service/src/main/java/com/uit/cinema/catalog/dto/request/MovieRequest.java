package com.uit.cinema.catalog.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.Set;

@Data
public class MovieRequest {
    @NotBlank(message = "Tên phim không được để trống")
    private String title;

    private String description;

    @NotNull(message = "Thời lượng phim không được để trống")
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
    private boolean active = true;
    private Set<Long> genreIds;
}
