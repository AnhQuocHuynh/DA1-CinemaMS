package com.uit.cinema.catalog.service.Impl;

import com.uit.cinema.catalog.dto.request.MovieRequest;
import com.uit.cinema.catalog.dto.response.MovieResponse;
import com.uit.cinema.catalog.entity.Genre;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.mapper.MovieMapper;
import com.uit.cinema.catalog.outbox.CatalogOutboxEventWriter;
import com.uit.cinema.catalog.repository.GenreRepository;
import com.uit.cinema.catalog.repository.MovieRepository;
import com.uit.cinema.core.exception.CustomException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MovieServiceImplTest {

    @Mock
    private MovieRepository movieRepository;

    @Mock
    private GenreRepository genreRepository;

    @Mock
    private MovieMapper movieMapper;

    @Mock
    private CatalogOutboxEventWriter catalogOutboxEventWriter;

    @InjectMocks
    private MovieServiceImpl movieService;

    @Test
    void getAllActiveMovies_ReturnsList() {
        Movie movie = new Movie();
        when(movieRepository.findByActiveTrueOrderByReleaseDateDesc()).thenReturn(List.of(movie));
        when(movieMapper.toResponse(movie)).thenReturn(new MovieResponse());

        List<MovieResponse> responses = movieService.getAllActiveMovies();

        assertEquals(1, responses.size());
    }

    @Test
    void getMovieById_WhenExists_ReturnsResponse() {
        Movie movie = new Movie();
        when(movieRepository.findById(1L)).thenReturn(Optional.of(movie));
        when(movieMapper.toResponse(movie)).thenReturn(new MovieResponse());

        MovieResponse response = movieService.getMovieById(1L);

        assertNotNull(response);
    }

    @Test
    void getMovieById_WhenNotExists_ThrowsException() {
        when(movieRepository.findById(1L)).thenReturn(Optional.empty());

        CustomException ex = assertThrows(CustomException.class, () -> movieService.getMovieById(1L));
        assertEquals("MOVIE_NOT_FOUND", ex.getErrorCode());
    }

    @Test
    void createMovie_Success() {
        MovieRequest request = new MovieRequest();
        request.setGenreIds(Set.of(1L));

        Movie movie = new Movie();
        when(movieMapper.toEntity(request)).thenReturn(movie);
        
        Genre genre = new Genre();
        when(genreRepository.findAllById(Set.of(1L))).thenReturn(List.of(genre));
        
        when(movieRepository.save(any(Movie.class))).thenReturn(movie);
        when(movieMapper.toResponse(movie)).thenReturn(new MovieResponse());

        MovieResponse response = movieService.createMovie(request);

        assertNotNull(response);
        verify(movieRepository).save(any(Movie.class));
        verify(catalogOutboxEventWriter).movieCreated(movie);
    }

    @Test
    void deleteMovie_SoftDeletes() {
        Movie movie = new Movie();
        movie.setActive(true);
        when(movieRepository.findById(1L)).thenReturn(Optional.of(movie));

        movieService.deleteMovie(1L);

        assertFalse(movie.isActive());
        verify(movieRepository).save(movie);
        verify(catalogOutboxEventWriter).movieDeleted(movie);
    }
    @Test
    void updateMovie_Success() {
        MovieRequest request = new MovieRequest();
        request.setTitle("New Title");
        request.setGenreIds(Set.of(1L));

        Movie movie = new Movie();
        movie.setId(1L);

        Genre genre = new Genre();
        genre.setId(1L);

        when(movieRepository.findById(1L)).thenReturn(Optional.of(movie));
        when(genreRepository.findAllById(Set.of(1L))).thenReturn(List.of(genre));
        when(movieRepository.save(any(Movie.class))).thenReturn(movie);
        
        MovieResponse mapped = new MovieResponse();
        when(movieMapper.toResponse(movie)).thenReturn(mapped);

        MovieResponse result = movieService.updateMovie(1L, request);

        assertNotNull(result);
        verify(movieMapper).updateEntity(movie, request);
        verify(movieRepository).save(movie);
        verify(catalogOutboxEventWriter).movieUpdated(movie);
    }

}
