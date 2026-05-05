package com.uit.cinema.catalog.service.Impl;

import com.uit.cinema.catalog.dto.request.MovieRequest;
import com.uit.cinema.catalog.dto.response.MovieResponse;
import com.uit.cinema.catalog.entity.Genre;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.repository.GenreRepository;
import com.uit.cinema.catalog.repository.MovieRepository;
import com.uit.cinema.catalog.service.MovieService;
import com.uit.cinema.core.exception.CustomException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MovieServiceImpl implements MovieService {

    private final MovieRepository movieRepository;
    private final GenreRepository genreRepository;

    @Override
    public List<MovieResponse> getAllActiveMovies() {
        return movieRepository.findByActiveTrueOrderByReleaseDateDesc().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    public MovieResponse getMovieById(Long id) {
        Movie movie = getMovieEntityById(id);
        return mapToResponse(movie);
    }

    private Movie getMovieEntityById(Long id) {
        return movieRepository.findById(id)
            .orElseThrow(() -> new CustomException("Phim không tồn tại", HttpStatus.NOT_FOUND, "MOVIE_NOT_FOUND"));
    }

    @Override
    @Transactional
    public MovieResponse createMovie(MovieRequest request) {
        Movie movie = Movie.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .durationMinutes(request.getDurationMinutes())
                .releaseDate(request.getReleaseDate())
                .ageRating(request.getAgeRating())
                .posterUrl(request.getPosterUrl())
                .trailerUrl(request.getTrailerUrl())
                .language(request.getLanguage())
                .active(request.isActive())
                .build();

        Set<Genre> genres = fetchGenres(request.getGenreIds());
        movie.setGenres(genres);

        Movie savedMovie = movieRepository.save(movie);
        return mapToResponse(savedMovie);
    }

    @Override
    @Transactional
    public MovieResponse updateMovie(Long id, MovieRequest request) {
        Movie existing = getMovieEntityById(id);
        existing.setTitle(request.getTitle());
        existing.setDescription(request.getDescription());
        existing.setDurationMinutes(request.getDurationMinutes());
        existing.setReleaseDate(request.getReleaseDate());
        existing.setAgeRating(request.getAgeRating());
        existing.setPosterUrl(request.getPosterUrl());
        existing.setTrailerUrl(request.getTrailerUrl());
        existing.setLanguage(request.getLanguage());
        existing.setActive(request.isActive());

        Set<Genre> genres = fetchGenres(request.getGenreIds());
        existing.setGenres(genres);

        Movie updatedMovie = movieRepository.save(existing);
        return mapToResponse(updatedMovie);
    }

    @Override
    @Transactional
    public void deleteMovie(Long id) {
        Movie movie = getMovieEntityById(id);
        movie.setActive(false);
        movieRepository.save(movie);
    }

    private Set<Genre> fetchGenres(Set<Long> genreIds) {
        if (genreIds == null || genreIds.isEmpty()) return new HashSet<>();
        return new HashSet<>(genreRepository.findAllById(genreIds));
    }

    private MovieResponse mapToResponse(Movie movie) {
        List<String> genreNames = movie.getGenres().stream()
                .map(Genre::getName)
                .collect(Collectors.toList());

        return MovieResponse.builder()
                .id(movie.getId())
                .title(movie.getTitle())
                .description(movie.getDescription())
                .durationMinutes(movie.getDurationMinutes())
                .releaseDate(movie.getReleaseDate())
                .ageRating(movie.getAgeRating())
                .posterUrl(movie.getPosterUrl())
                .trailerUrl(movie.getTrailerUrl())
                .language(movie.getLanguage())
                .active(movie.isActive())
                .genres(genreNames)
                .createdAt(movie.getCreatedAt())
                .updatedAt(movie.getUpdatedAt())
                .build();
    }
}
