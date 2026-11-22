package com.uit.cinema.catalog.service.Impl;

import com.uit.cinema.catalog.dto.response.MovieFeatureResponse;
import com.uit.cinema.catalog.entity.Genre;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.repository.MovieRepository;
import com.uit.cinema.catalog.service.MovieAvailability;
import com.uit.cinema.core.exception.CustomException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MovieFeatureService {

    private final MovieRepository movieRepository;

    @Transactional(readOnly = true)
    public List<MovieFeatureResponse> listFeatures() {
        LocalDate today = LocalDate.now();
        return movieRepository.findAllWithGenres().stream()
                .map(movie -> toFeature(movie, today))
                .toList();
    }

    @Transactional(readOnly = true)
    public MovieFeatureResponse getFeature(Long movieId) {
        Movie movie = movieRepository.findById(movieId)
                .orElseThrow(() -> new CustomException("Movie not found", HttpStatus.NOT_FOUND, "MOVIE_NOT_FOUND"));
        return toFeature(movie, LocalDate.now());
    }

    private MovieFeatureResponse toFeature(Movie movie, LocalDate today) {
        String genreCsv = movie.getGenres() == null ? "" : movie.getGenres().stream()
                .map(Genre::getName)
                .filter(name -> name != null && !name.isBlank())
                .sorted(Comparator.naturalOrder())
                .collect(Collectors.joining(", "));
        Integer releaseYear = movie.getReleaseDate() == null ? null : movie.getReleaseDate().getYear();
        return MovieFeatureResponse.builder()
                .id(movie.getId())
                .title(movie.getTitle())
                .posterUrl(movie.getPosterUrl())
                .durationMinutes(movie.getDurationMinutes())
                .releaseYear(releaseYear)
                .imdbRating(movie.getImdbRating())
                .region(movie.getRegion())
                .language(movie.getLanguage())
                .genreCsv(genreCsv)
                .status(MovieAvailability.statusOf(movie.isActive(), movie.getReleaseDate(), today))
                .imdbId(movie.getImdbId())
                .build();
    }
}
