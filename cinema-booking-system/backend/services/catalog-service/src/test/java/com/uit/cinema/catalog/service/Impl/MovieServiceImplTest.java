package com.uit.cinema.catalog.service.Impl;

import com.uit.cinema.catalog.dto.request.MovieRequest;
import com.uit.cinema.catalog.dto.response.MovieResponse;
import com.uit.cinema.catalog.entity.Genre;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.mapper.MovieMapper;
import com.uit.cinema.catalog.outbox.CatalogOutboxEventWriter;
import com.uit.cinema.catalog.repository.GenreRepository;
import com.uit.cinema.catalog.repository.MovieRepository;
import com.uit.cinema.catalog.service.MovieSummaryAgent;
import com.uit.cinema.core.exception.CustomException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
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

    @Mock
    private MovieSummaryAgent movieSummaryAgent;

    private MovieServiceImpl movieService;

    @BeforeEach
    void setUp() {
        PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
        lenient().when(transactionManager.getTransaction(any())).thenReturn(mock(TransactionStatus.class));
        movieService = new MovieServiceImpl(
            movieRepository,
            genreRepository,
            movieMapper,
            catalogOutboxEventWriter,
            new TransactionTemplate(transactionManager),
            movieSummaryAgent
        );
    }

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
        verify(movieSummaryAgent, never()).summarize(any(), any(), any());
    }

    @Test
    void createMovie_storesSummaryFromAgent() {
        MovieRequest request = new MovieRequest();
        request.setTitle("Inception");
        request.setDescription("A thief enters dreams.");
        request.setGenreIds(Set.of(1L));

        Movie movie = new Movie();
        movie.setId(7L);
        when(movieMapper.toEntity(request)).thenReturn(movie);

        Genre genre = new Genre();
        genre.setName("Sci-Fi");
        when(genreRepository.findAllById(Set.of(1L))).thenReturn(List.of(genre));
        when(movieRepository.save(any(Movie.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(movieRepository.findById(7L)).thenReturn(Optional.of(movie));

        MovieResponse mapped = new MovieResponse();
        mapped.setId(7L);
        mapped.setTitle("Inception");
        mapped.setDescription("A thief enters dreams.");
        mapped.setGenres(List.of("Sci-Fi"));
        when(movieMapper.toResponse(any(Movie.class))).thenReturn(mapped);
        when(movieSummaryAgent.summarize("Inception", "A thief enters dreams.", List.of("Sci-Fi")))
            .thenReturn(Optional.of("A dream heist."));

        MovieResponse response = movieService.createMovie(request);

        assertEquals("A dream heist.", response.getAiSummary());
        assertEquals("A dream heist.", movie.getAiSummary());
        verify(catalogOutboxEventWriter, times(1)).movieCreated(movie);
        verify(movieRepository, times(2)).save(any(Movie.class));
    }

    @Test
    void createMovie_whenAgentFails_stillCreatesMovie() {
        MovieRequest request = new MovieRequest();
        request.setDescription("A long plot.");

        Movie movie = new Movie();
        movie.setId(3L);
        when(movieMapper.toEntity(request)).thenReturn(movie);
        when(movieRepository.save(any(Movie.class))).thenReturn(movie);

        MovieResponse mapped = new MovieResponse();
        mapped.setId(3L);
        mapped.setTitle("Title");
        mapped.setDescription("A long plot.");
        when(movieMapper.toResponse(movie)).thenReturn(mapped);
        when(movieSummaryAgent.summarize(any(), any(), any())).thenThrow(new IllegalStateException("down"));

        MovieResponse response = movieService.createMovie(request);

        assertNotNull(response);
        assertNull(response.getAiSummary());
        verify(catalogOutboxEventWriter).movieCreated(movie);
        verify(movieRepository, times(1)).save(any(Movie.class));
    }

    @Test
    void createMovie_blankDescription_doesNotCallAgent() {
        MovieRequest request = new MovieRequest();
        request.setDescription("   ");

        Movie movie = new Movie();
        when(movieMapper.toEntity(request)).thenReturn(movie);
        when(movieRepository.save(any(Movie.class))).thenReturn(movie);

        MovieResponse mapped = new MovieResponse();
        mapped.setDescription("   ");
        when(movieMapper.toResponse(movie)).thenReturn(mapped);

        MovieResponse response = movieService.createMovie(request);

        assertNull(response.getAiSummary());
        verify(movieSummaryAgent, never()).summarize(any(), any(), any());
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
        verify(movieSummaryAgent, never()).summarize(any(), any(), any());
    }

    @Test
    void updateMovie_descriptionChanged_replacesSummary() {
        MovieRequest request = new MovieRequest();
        request.setTitle("Inception");
        request.setDescription("A new plot.");
        request.setGenreIds(Set.of());

        Movie movie = new Movie();
        movie.setId(1L);
        movie.setDescription("The old plot.");
        movie.setAiSummary("Old summary.");

        when(movieRepository.findById(1L)).thenReturn(Optional.of(movie));
        when(movieRepository.save(any(Movie.class))).thenAnswer(invocation -> invocation.getArgument(0));
        doAnswer(invocation -> {
            Movie target = invocation.getArgument(0);
            MovieRequest incoming = invocation.getArgument(1);
            target.setTitle(incoming.getTitle());
            target.setDescription(incoming.getDescription());
            return null;
        }).when(movieMapper).updateEntity(movie, request);

        MovieResponse mapped = new MovieResponse();
        mapped.setId(1L);
        mapped.setTitle("Inception");
        mapped.setDescription("A new plot.");
        mapped.setAiSummary("Old summary.");
        mapped.setGenres(List.of());
        when(movieMapper.toResponse(movie)).thenReturn(mapped);
        when(movieSummaryAgent.summarize("Inception", "A new plot.", List.of()))
            .thenReturn(Optional.of("New summary."));

        MovieResponse result = movieService.updateMovie(1L, request);

        assertEquals("New summary.", result.getAiSummary());
        assertEquals("New summary.", movie.getAiSummary());
        verify(catalogOutboxEventWriter).movieUpdated(movie);
    }

    @Test
    void updateMovie_descriptionUnchanged_doesNotCallAgent() {
        MovieRequest request = new MovieRequest();
        request.setTitle("New Title");
        request.setDescription("Same plot.");
        request.setGenreIds(Set.of());

        Movie movie = new Movie();
        movie.setId(1L);
        movie.setDescription("Same plot.");
        movie.setAiSummary("Kept summary.");

        when(movieRepository.findById(1L)).thenReturn(Optional.of(movie));
        when(movieRepository.save(any(Movie.class))).thenReturn(movie);
        MovieResponse mapped = new MovieResponse();
        mapped.setAiSummary("Kept summary.");
        when(movieMapper.toResponse(movie)).thenReturn(mapped);

        MovieResponse result = movieService.updateMovie(1L, request);

        assertEquals("Kept summary.", result.getAiSummary());
        verify(movieSummaryAgent, never()).summarize(any(), any(), any());
    }

    @Test
    void updateMovie_blankDescription_clearsSummaryWithoutCallingAgent() {
        MovieRequest request = new MovieRequest();
        request.setDescription("  ");

        Movie movie = new Movie();
        movie.setId(1L);
        movie.setDescription("Old plot.");
        movie.setAiSummary("Old summary.");

        when(movieRepository.findById(1L)).thenReturn(Optional.of(movie));
        when(movieRepository.save(any(Movie.class))).thenAnswer(invocation -> invocation.getArgument(0));
        MovieResponse mapped = new MovieResponse();
        when(movieMapper.toResponse(movie)).thenAnswer(invocation -> {
            mapped.setAiSummary(movie.getAiSummary());
            mapped.setDescription(movie.getDescription());
            return mapped;
        });

        MovieResponse result = movieService.updateMovie(1L, request);

        assertNull(movie.getAiSummary());
        assertNull(result.getAiSummary());
        verify(movieSummaryAgent, never()).summarize(any(), any(), any());
    }
}
