package com.uit.cinema.recommendation.dto;

import java.util.List;

public record TasteProfileResponse(
    Long userId,
    List<String> preferredGenres,
    long watchedMovies,
    boolean fallbackUsed
) {
}
