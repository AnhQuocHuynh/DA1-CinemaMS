package com.uit.cinema.catalog.service.Impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.repository.MovieRepository;
import com.uit.cinema.core.exception.CustomException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.SocketTimeoutException;
import java.time.Year;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
public class MovieBulkImportService {

    static final int DEFAULT_LIMIT = 20;
    static final int MAX_LIMIT = 100;
    private static final int FETCH_PAGE_SIZE = 50;
    private static final int YEAR_SLICE_SIZE = 5;
    private static final int MAX_YEAR_SLICES = 20;
    private static final int MAX_STALE_SLICES = 8;
    private static final int MIN_RELEASE_YEAR = 1920;

    private final RestTemplate imdbRestTemplate;
    private final ImdbSyncService imdbSyncService;
    private final MovieRepository movieRepository;

    @Value("${imdb.api.base-url:https://api.imdbapi.dev}")
    private String imdbApiBaseUrl;

    @Value("${imdb.bulk-import.delay-ms:1200}")
    private long delayMs;

    public int clampLimit(int limit) {
        if (limit <= 0) {
            return DEFAULT_LIMIT;
        }
        return Math.min(limit, MAX_LIMIT);
    }

    @Async
    public CompletableFuture<Void> importMoviesByGenre(String genre, int limit) {
        if (genre == null || genre.isBlank()) {
            throw new IllegalArgumentException("genre must not be blank");
        }

        int normalizedLimit = clampLimit(limit);
        int importedCount = 0;
        int staleSlices = 0;
        int currentYear = Year.now().getValue() + 1;
        Set<String> processedImdbIds = new LinkedHashSet<>();
        log.info("Bulk import started. genre={}, requestedLimit={}", genre, normalizedLimit);

        for (int sliceIndex = 0; importedCount < normalizedLimit && sliceIndex < MAX_YEAR_SLICES; sliceIndex++) {
            int sliceEndYear = currentYear - (sliceIndex * YEAR_SLICE_SIZE);
            int sliceStartYear = Math.max(MIN_RELEASE_YEAR, sliceEndYear - YEAR_SLICE_SIZE + 1);
            if (sliceEndYear < MIN_RELEASE_YEAR) {
                break;
            }

            List<String> imdbIds = fetchImdbIdsByGenre(genre.trim(), FETCH_PAGE_SIZE, sliceStartYear, sliceEndYear);
            if (imdbIds.isEmpty()) {
                staleSlices++;
                if (staleSlices >= MAX_STALE_SLICES) {
                    break;
                }
                continue;
            }

            int importedBeforeSlice = importedCount;
            for (String imdbId : imdbIds) {
                if (importedCount >= normalizedLimit) {
                    break;
                }
                if (imdbId == null || imdbId.isBlank() || !processedImdbIds.add(imdbId.trim())) {
                    continue;
                }
                if (importIfMissing(imdbId.trim())) {
                    importedCount++;
                }
            }

            staleSlices = importedCount == importedBeforeSlice ? staleSlices + 1 : 0;
            if (staleSlices >= MAX_STALE_SLICES) {
                break;
            }
        }

        log.info("Bulk import completed. genre={}, totalImported={}, requestedLimit={}", genre, importedCount, normalizedLimit);
        return CompletableFuture.completedFuture(null);
    }

    private boolean importIfMissing(String imdbId) {
        if (movieRepository.existsByImdbId(imdbId)) {
            return false;
        }
        try {
            Movie importedMovie = imdbSyncService.syncMovieByImdbId(imdbId);
            log.info("Imported imdbId={}", importedMovie.getImdbId());
            return true;
        } catch (DataIntegrityViolationException dataIntegrityViolationException) {
            log.info("Skip imdbId={} because it was inserted concurrently", imdbId);
            return false;
        } catch (Exception exception) {
            log.warn("Failed to import imdbId={}: {}", imdbId, exception.getMessage());
            return false;
        } finally {
            applyRateLimitDelay();
        }
    }

    private List<String> fetchImdbIdsByGenre(String genre, int limit, int startYear, int endYear) {
        UriComponentsBuilder uriBuilder = UriComponentsBuilder
                .fromHttpUrl(imdbApiBaseUrl + "/titles")
                .queryParam("genre", genre)
                .queryParam("limit", limit)
                .queryParam("startYear", startYear)
                .queryParam("endYear", endYear);
        try {
            ResponseEntity<JsonNode> response = imdbRestTemplate.getForEntity(uriBuilder.build(true).toUri(), JsonNode.class);
            JsonNode body = response.getBody();
            if (body == null || body.isNull()) {
                return List.of();
            }
            JsonNode titlesNode = unwrapTitleArray(body);
            if (titlesNode == null || !titlesNode.isArray()) {
                return List.of();
            }
            Set<String> uniqueIds = new LinkedHashSet<>();
            for (JsonNode titleNode : titlesNode) {
                JsonNode idNode = titleNode.get("id");
                if (idNode == null || !idNode.isTextual()) {
                    idNode = titleNode.get("imdbId");
                }
                if (idNode != null && idNode.isTextual() && !idNode.asText().isBlank()) {
                    uniqueIds.add(idNode.asText().trim());
                }
                if (uniqueIds.size() >= limit) {
                    break;
                }
            }
            return new ArrayList<>(uniqueIds);
        } catch (ResourceAccessException resourceAccessException) {
            Throwable rootCause = resourceAccessException.getMostSpecificCause();
            if (rootCause instanceof SocketTimeoutException) {
                throw new CustomException("IMDb API timeout while fetching titles by genre", HttpStatus.GATEWAY_TIMEOUT, "IMDB_TIMEOUT");
            }
            throw new CustomException("Cannot access IMDb API: " + resourceAccessException.getMessage(), HttpStatus.BAD_GATEWAY, "IMDB_UNAVAILABLE");
        } catch (RestClientException restClientException) {
            throw new CustomException("IMDb API error: " + restClientException.getMessage(), HttpStatus.BAD_GATEWAY, "IMDB_ERROR");
        }
    }

    private void applyRateLimitDelay() {
        if (delayMs <= 0) {
            return;
        }
        try {
            Thread.sleep(delayMs);
        } catch (InterruptedException interruptedException) {
            Thread.currentThread().interrupt();
        }
    }

    private JsonNode unwrapTitleArray(JsonNode body) {
        if (body.isArray()) {
            return body;
        }
        for (String path : new String[]{"titles", "results", "data", "items"}) {
            JsonNode node = body.get(path);
            if (node != null && node.isArray()) {
                return node;
            }
        }
        return null;
    }
}
