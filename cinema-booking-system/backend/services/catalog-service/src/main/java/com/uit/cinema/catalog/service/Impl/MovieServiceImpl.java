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
    private final MovieMapper movieMapper;
    private final CatalogOutboxEventWriter catalogOutboxEventWriter;

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
    @Transactional
    public MovieResponse createMovie(MovieRequest request) {
        Movie movie = movieMapper.toEntity(request);
        Set<Genre> genres = fetchGenres(request.getGenreIds());
        movie.setGenres(genres);

        Movie savedMovie = movieRepository.save(movie);
        catalogOutboxEventWriter.movieCreated(savedMovie);
        return movieMapper.toResponse(savedMovie);
    }

    @Override
    @Transactional
    public MovieResponse updateMovie(Long id, MovieRequest request) {
        Movie existing = getMovieEntityById(id);
        movieMapper.updateEntity(existing, request);
        
        Set<Genre> genres = fetchGenres(request.getGenreIds());
        existing.setGenres(genres);

        Movie updatedMovie = movieRepository.save(existing);
        catalogOutboxEventWriter.movieUpdated(updatedMovie);
        return movieMapper.toResponse(updatedMovie);
    }

    @Override
    @Transactional
    public void deleteMovie(Long id) {
        Movie movie = getMovieEntityById(id);
        movie.setActive(false);
        movieRepository.save(movie);
        catalogOutboxEventWriter.movieDeleted(movie);
    }

    private Set<Genre> fetchGenres(Set<Long> genreIds) {
        if (genreIds == null || genreIds.isEmpty()) return new HashSet<>();
        return new HashSet<>(genreRepository.findAllById(genreIds));
    }
}
