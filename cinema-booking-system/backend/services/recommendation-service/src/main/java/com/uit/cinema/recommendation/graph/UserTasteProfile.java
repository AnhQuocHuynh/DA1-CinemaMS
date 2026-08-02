package com.uit.cinema.recommendation.graph;

import java.util.List;

public record UserTasteProfile(
    List<String> preferredGenres,
    long watchedMovies
) {
    public static UserTasteProfile empty() {
        return new UserTasteProfile(List.of(), 0);
    }
}
