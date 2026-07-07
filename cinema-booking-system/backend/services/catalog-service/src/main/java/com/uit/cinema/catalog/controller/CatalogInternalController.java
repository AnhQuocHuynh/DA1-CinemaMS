package com.uit.cinema.catalog.controller;

import com.uit.cinema.catalog.service.CatalogReadService;
import com.uit.cinema.catalog.service.contract.CatalogContentView;
import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.core.exception.CustomException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/catalog")
@RequiredArgsConstructor
public class CatalogInternalController {

    private final CatalogReadService catalogReadService;

    @GetMapping("/movies/{movieId}")
    public ResponseEntity<ApiResponse<CatalogContentView>> getMovie(@PathVariable Long movieId) {
        CatalogContentView movie = catalogReadService.findMovie(movieId)
            .orElseThrow(() -> new CustomException("Movie not found", HttpStatus.NOT_FOUND, "MOVIE_NOT_FOUND"));
        return ResponseEntity.ok(ApiResponse.success(movie));
    }

    @GetMapping("/events/{eventId}")
    public ResponseEntity<ApiResponse<CatalogContentView>> getEvent(@PathVariable Long eventId) {
        CatalogContentView event = catalogReadService.findEvent(eventId)
            .orElseThrow(() -> new CustomException("Event not found", HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND"));
        return ResponseEntity.ok(ApiResponse.success(event));
    }
}
