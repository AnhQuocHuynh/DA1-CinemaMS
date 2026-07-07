package com.uit.cinema.catalog.service.Impl;

import com.uit.cinema.catalog.entity.Event;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.repository.EventRepository;
import com.uit.cinema.catalog.repository.MovieRepository;
import com.uit.cinema.catalog.service.CatalogReadService;
import com.uit.cinema.catalog.service.contract.CatalogContentView;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CatalogReadServiceImpl implements CatalogReadService {

    private final MovieRepository movieRepository;
    private final EventRepository eventRepository;

    @Override
    public Optional<CatalogContentView> findMovie(Long movieId) {
        if (movieId == null) {
            return Optional.empty();
        }
        return movieRepository.findById(movieId)
            .map(movie -> new CatalogContentView(movie.getId(), movie.getTitle(), "MOVIE", movie.getReleaseDate()));
    }

    @Override
    public Optional<CatalogContentView> findEvent(Long eventId) {
        if (eventId == null) {
            return Optional.empty();
        }
        return eventRepository.findById(eventId)
            .map(event -> new CatalogContentView(event.getId(), event.getName(), "EVENT"));
    }

    @Override
    public boolean movieExists(Long movieId) {
        return movieId != null && movieRepository.existsById(movieId);
    }

    @Override
    public boolean eventExists(Long eventId) {
        return eventId != null && eventRepository.existsById(eventId);
    }
}
