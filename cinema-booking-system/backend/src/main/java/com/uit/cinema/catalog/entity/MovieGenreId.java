package com.uit.cinema.catalog.entity;

import java.io.Serializable;
import java.util.Objects;

public class MovieGenreId implements Serializable {

    private Long movieId;
    private Long genreId;

    public MovieGenreId() {}

    public MovieGenreId(Long movieId, Long genreId) {
        this.movieId = movieId;
        this.genreId = genreId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof MovieGenreId that)) return false;
        return Objects.equals(movieId, that.movieId) && Objects.equals(genreId, that.genreId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(movieId, genreId);
    }
}
