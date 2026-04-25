package com.uit.cinema.catalog.service;

import com.uit.cinema.catalog.entity.Movie;

import java.util.List;

public interface MovieService {
    List<Movie> getAllActiveMovies();
    Movie getMovieById(Long id);
    Movie createMovie(Movie movie);
    Movie updateMovie(Long id, Movie updated);
    void deleteMovie(Long id);
}
