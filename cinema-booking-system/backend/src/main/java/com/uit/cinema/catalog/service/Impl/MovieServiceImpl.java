package com.uit.cinema.catalog.service.Impl;

import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.repository.MovieRepository;
import com.uit.cinema.catalog.service.MovieService;
import com.uit.cinema.core.exception.CustomException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MovieServiceImpl implements MovieService {

    private final MovieRepository movieRepository;

    @Override
    public List<Movie> getAllActiveMovies() {
        return movieRepository.findByActiveTrueOrderByReleaseDateDesc();
    }

    @Override
    public Movie getMovieById(Long id) {
        return movieRepository.findById(id)
            .orElseThrow(() -> new CustomException("Phim không tồn tại", HttpStatus.NOT_FOUND, "MOVIE_NOT_FOUND"));
    }

    @Override
    @Transactional
    public Movie createMovie(Movie movie) {
        return movieRepository.save(movie);
    }

    @Override
    @Transactional
    public Movie updateMovie(Long id, Movie updated) {
        Movie existing = getMovieById(id);
        existing.setTitle(updated.getTitle());
        existing.setDescription(updated.getDescription());
        existing.setDurationMinutes(updated.getDurationMinutes());
        existing.setReleaseDate(updated.getReleaseDate());
        existing.setAgeRating(updated.getAgeRating());
        existing.setPosterUrl(updated.getPosterUrl());
        existing.setTrailerUrl(updated.getTrailerUrl());
        existing.setLanguage(updated.getLanguage());
        return movieRepository.save(existing);
    }

    @Override
    @Transactional
    public void deleteMovie(Long id) {
        Movie movie = getMovieById(id);
        movie.setActive(false);
        movieRepository.save(movie);
    }
}
