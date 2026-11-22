package com.uit.cinema.catalog.service.Impl;

import com.uit.cinema.catalog.dto.request.MovieRequest;
import com.uit.cinema.catalog.dto.response.MovieResponse;
import com.uit.cinema.catalog.entity.Genre;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.mapper.MovieMapper;
import com.uit.cinema.catalog.outbox.CatalogOutboxEventWriter;
import com.uit.cinema.catalog.repository.GenreRepository;
import com.uit.cinema.catalog.repository.MovieRepository;
import com.uit.cinema.catalog.service.MovieService;
import com.uit.cinema.catalog.service.MovieSummaryAgent;
import com.uit.cinema.core.exception.CustomException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MovieServiceImpl implements MovieService {

    private final MovieRepository movieRepository;
    private final GenreRepository genreRepository;
    private final MovieMapper movieMapper;
    private final CatalogOutboxEventWriter catalogOutboxEventWriter;
    private final TransactionTemplate transactionTemplate;
    private final MovieSummaryAgent movieSummaryAgent;

    @Override
    public List<MovieResponse> getAllActiveMovies() {
        return movieRepository.findByActiveTrueOrderByReleaseDateDesc().stream()
                .map(movieMapper::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    public MovieResponse getMovieById(Long id) {
        Movie movie = getMovieEntityById(id);
        return movieMapper.toResponse(movie);
    }

    private Movie getMovieEntityById(Long id) {
        return movieRepository.findById(id)
            .orElseThrow(() -> new CustomException("Phim không tồn tại", HttpStatus.NOT_FOUND, "MOVIE_NOT_FOUND"));
    }

    @Override
    public MovieResponse createMovie(MovieRequest request) {
        MovieResponse response = transactionTemplate.execute(status -> {
            Movie movie = movieMapper.toEntity(request);
            movie.setGenres(fetchGenres(request.getGenreIds()));
            Movie savedMovie = movieRepository.save(movie);
            catalogOutboxEventWriter.movieCreated(savedMovie);
            return movieMapper.toResponse(savedMovie);
        });
        response = Objects.requireNonNull(response);
        String summary = requestSummary(response.getTitle(), response.getDescription(), response.getGenres());
        if (summary != null) {
            storeSummary(response.getId(), summary, response);
        }
        return response;
    }

    @Override
    public MovieResponse updateMovie(Long id, MovieRequest request) {
        MovieWrite write = transactionTemplate.execute(status -> {
            Movie existing = getMovieEntityById(id);
            boolean descriptionChanged = !normalize(existing.getDescription()).equals(normalize(request.getDescription()));
            movieMapper.updateEntity(existing, request);
            existing.setGenres(fetchGenres(request.getGenreIds()));
            if (descriptionChanged && normalize(request.getDescription()).isEmpty()) {
                existing.setAiSummary(null);
            }
            Movie updatedMovie = movieRepository.save(existing);
            catalogOutboxEventWriter.movieUpdated(updatedMovie);
            return new MovieWrite(movieMapper.toResponse(updatedMovie), descriptionChanged);
        });
        write = Objects.requireNonNull(write);
        MovieResponse response = write.response();
        if (write.descriptionChanged() && !normalize(request.getDescription()).isEmpty()) {
            String summary = requestSummary(response.getTitle(), request.getDescription(), response.getGenres());
            storeSummary(id, summary, response);
        }
        return response;
    }

    @Override
    @Transactional
    public void deleteMovie(Long id) {
        Movie movie = getMovieEntityById(id);
        movie.setActive(false);
        movieRepository.save(movie);
        catalogOutboxEventWriter.movieDeleted(movie);
    }

    private String requestSummary(String title, String description, List<String> genres) {
        if (normalize(description).isEmpty()) {
            return null;
        }
        try {
            return movieSummaryAgent.summarize(title, description, genres == null ? List.of() : genres)
                .map(String::strip)
                .filter(text -> !text.isEmpty())
                .orElse(null);
        } catch (RuntimeException ex) {
            log.warn("Movie summary failed for '{}': {}", title, ex.toString());
            return null;
        }
    }

    private void storeSummary(Long movieId, String summary, MovieResponse response) {
        if (movieId == null) {
            return;
        }
        try {
            transactionTemplate.executeWithoutResult(status -> {
                Movie movie = movieRepository.findById(movieId).orElse(null);
                if (movie == null) {
                    return;
                }
                movie.setAiSummary(summary);
                movieRepository.save(movie);
            });
            response.setAiSummary(summary);
        } catch (RuntimeException ex) {
            log.warn("Could not store movie summary for id {}: {}", movieId, ex.toString());
        }
    }

    private Set<Genre> fetchGenres(Set<Long> genreIds) {
        if (genreIds == null || genreIds.isEmpty()) return new HashSet<>();
        return new HashSet<>(genreRepository.findAllById(genreIds));
    }

    private static String normalize(String value) {
        return value == null ? "" : value.strip();
    }

    private record MovieWrite(MovieResponse response, boolean descriptionChanged) {
    }
}
