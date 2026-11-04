package com.api.moviebooking.models.dtos.imdb;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
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
