package com.uit.cinema.catalog.service.Impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.repository.MovieRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.lang.reflect.Field;
import java.net.URI;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MovieBulkImportServiceTest {

    @Mock
    private RestTemplate imdbRestTemplate;

    @Mock
    private ImdbSyncService imdbSyncService;

    @Mock
    private MovieRepository movieRepository;

    @InjectMocks
    private MovieBulkImportService service;

    @BeforeEach
    void configureOfflineImport() throws Exception {
        setField("imdbApiBaseUrl", "https://api.imdbapi.dev");
        setField("delayMs", 0L);
    }

    @Test
    void clampLimitUsesDefaultsAndCapsAtOneHundred() {
        assertEquals(20, service.clampLimit(0));
        assertEquals(100, service.clampLimit(500));
        assertEquals(7, service.clampLimit(7));
    }

    @Test
    void importStopsAfterTheRequestedMissingTitle() throws Exception {
        JsonNode body = new ObjectMapper().readTree("{\"titles\":[{\"id\":\"tt1\"},{\"id\":\"tt2\"}]}");
        when(imdbRestTemplate.getForEntity(any(URI.class), eq(JsonNode.class)))
                .thenReturn(ResponseEntity.ok(body));
        when(movieRepository.existsByImdbId("tt1")).thenReturn(false);
        when(imdbSyncService.syncMovieByImdbId("tt1")).thenReturn(Movie.builder().imdbId("tt1").title("One").build());

        service.importMoviesByGenre("Action", 1).join();

        verify(imdbSyncService).syncMovieByImdbId("tt1");
        verify(imdbSyncService, never()).syncMovieByImdbId("tt2");
    }

    private void setField(String name, Object value) throws Exception {
        Field field = MovieBulkImportService.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(service, value);
    }
}
