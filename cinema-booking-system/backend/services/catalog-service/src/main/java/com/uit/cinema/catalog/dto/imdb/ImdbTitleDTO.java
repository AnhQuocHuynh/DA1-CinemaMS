package com.uit.cinema.catalog.dto.imdb;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImdbTitleDTO {
    private String imdbId;
    private String title;
    private Integer releaseYear;
    private Double imdbRating;
    private String genre;
    private String region;
    private String language;
    private Integer duration;
    private String posterUrl;
}
