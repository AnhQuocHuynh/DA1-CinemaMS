package com.uit.cinema.catalog.service.Impl;

import com.uit.cinema.catalog.dto.response.CatalogSearchResponse;
import com.uit.cinema.catalog.dto.response.EventResponse;
import com.uit.cinema.catalog.dto.response.MovieResponse;
import com.uit.cinema.catalog.entity.Event;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.mapper.EventMapper;
import com.uit.cinema.catalog.mapper.MovieMapper;
import com.uit.cinema.catalog.repository.EventRepository;
import com.uit.cinema.catalog.repository.MovieRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CatalogServiceImplTest {

    @Mock
    private MovieRepository movieRepository;

    @Mock
    private EventRepository eventRepository;

    @Mock
    private MovieMapper movieMapper;

    @Mock
    private EventMapper eventMapper;

    @InjectMocks
    private CatalogServiceImpl catalogService;

    @Test
    void search_WithKeyword_ReturnsUnifiedResults() {
        Movie movie = new Movie();
        movie.setId(1L);
        movie.setTitle("Avengers");

        Event event = new Event();
        event.setId(10L);
        event.setName("Fan Meeting");

        Page<Movie> moviePage = new PageImpl<>(List.of(movie));
        Page<Event> eventPage = new PageImpl<>(List.of(event));

        when(movieRepository.searchMovies(eq("Avengers"), isNull(), isNull(), isNull(), any(Pageable.class)))
                .thenReturn(moviePage);
        when(eventRepository.searchEvents(eq("Avengers"), isNull(), isNull(), any(LocalDateTime.class), any(Pageable.class)))
                .thenReturn(eventPage);

        MovieResponse mockMovieResp = new MovieResponse();
        when(movieMapper.toResponse(movie)).thenReturn(mockMovieResp);

        EventResponse mockEventResp = new EventResponse();
        when(eventMapper.toResponse(event)).thenReturn(mockEventResp);

        CatalogSearchResponse response = catalogService.search("Avengers", null, null, null, 0, 10);

        assertEquals(1, response.getMovies().size());
        assertEquals(1, response.getEvents().size());
        assertEquals(1, response.getMovieTotalElements());
        assertEquals(1, response.getEventTotalElements());

        // Verify the >24h rule is applied (the query passes a minEndTime to the repository)
        verify(eventRepository).searchEvents(eq("Avengers"), isNull(), isNull(), any(LocalDateTime.class), any(Pageable.class));
    }

    @Test
    void search_WithEmptyKeyword_NormalizesToNull() {
        Page<Movie> moviePage = new PageImpl<>(List.of());
        Page<Event> eventPage = new PageImpl<>(List.of());

        when(movieRepository.searchMovies(isNull(), isNull(), isNull(), isNull(), any(Pageable.class)))
                .thenReturn(moviePage);
        when(eventRepository.searchEvents(isNull(), isNull(), isNull(), any(LocalDateTime.class), any(Pageable.class)))
                .thenReturn(eventPage);

        CatalogSearchResponse response = catalogService.search("   ", null, null, null, 0, 10);

        assertEquals(0, response.getMovies().size());
        assertEquals(0, response.getEvents().size());
    }
}
