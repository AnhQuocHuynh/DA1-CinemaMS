package com.uit.cinema.catalog.service.Impl;

import com.uit.cinema.catalog.dto.response.CatalogSearchResponse;
import com.uit.cinema.catalog.dto.response.MovieResponse;
import com.uit.cinema.catalog.dto.response.EventResponse;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.entity.Event;
import com.uit.cinema.catalog.mapper.MovieMapper;
import com.uit.cinema.catalog.mapper.EventMapper;
import com.uit.cinema.catalog.repository.MovieRepository;
import com.uit.cinema.catalog.repository.EventRepository;
import com.uit.cinema.catalog.service.CatalogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CatalogServiceImpl implements CatalogService {

    private final MovieRepository movieRepository;
    private final EventRepository eventRepository;
    private final MovieMapper movieMapper;
    private final EventMapper eventMapper;

    @Override
    @Transactional(readOnly = true)
    public CatalogSearchResponse search(String keyword, Long genreId, LocalDate fromDate, LocalDate toDate, int page, int size) {
        // Chuẩn hóa từ khóa tìm kiếm
        String cleanKeyword = (keyword == null || keyword.trim().isEmpty()) ? null : keyword.trim();

        Pageable pageable = PageRequest.of(page, size, Sort.by("id").ascending());

        // Lọc Phim
        Page<Movie> moviePage = movieRepository.searchMovies(cleanKeyword, genreId, fromDate, toDate, pageable);
        List<MovieResponse> movies = moviePage.getContent().stream()
                .map(movieMapper::toResponse)
                .collect(Collectors.toList());

        // Lọc Sự kiện
        LocalDateTime eventStart = fromDate != null ? fromDate.atStartOfDay() : null;
        LocalDateTime eventEnd = toDate != null ? toDate.atTime(23, 59, 59) : null;
        LocalDateTime minEndTime = LocalDateTime.now().minusHours(24); // Tự động ẩn nội dung cũ >24h

        Page<Event> eventPage = eventRepository.searchEvents(cleanKeyword, eventStart, eventEnd, minEndTime, pageable);
        List<EventResponse> events = eventPage.getContent().stream()
                .map(eventMapper::toResponse)
                .collect(Collectors.toList());

        return CatalogSearchResponse.builder()
                .movies(movies)
                .events(events)
                .movieTotalPages(moviePage.getTotalPages())
                .eventTotalPages(eventPage.getTotalPages())
                .movieTotalElements(moviePage.getTotalElements())
                .eventTotalElements(eventPage.getTotalElements())
                .build();
    }
}
