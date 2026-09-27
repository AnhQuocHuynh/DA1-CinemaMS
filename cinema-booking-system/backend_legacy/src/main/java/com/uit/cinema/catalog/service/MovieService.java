package com.uit.cinema.catalog.service;

import com.uit.cinema.catalog.dto.request.MovieRequest;
import com.uit.cinema.catalog.dto.response.MovieResponse;

import java.util.List;

public interface MovieService {
    List<MovieResponse> getAllActiveMovies();
    MovieResponse getMovieById(Long id);
    MovieResponse createMovie(MovieRequest request);
    MovieResponse updateMovie(Long id, MovieRequest request);
    void deleteMovie(Long id);
}
