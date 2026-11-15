package com.uit.cinema.catalog.service.Impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.uit.cinema.catalog.dto.imdb.ImdbTitleDTO;
import com.uit.cinema.catalog.entity.Genre;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.outbox.CatalogOutboxEventWriter;
import com.uit.cinema.catalog.repository.GenreRepository;
import com.uit.cinema.catalog.repository.MovieRepository;
import com.uit.cinema.core.exception.CustomException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.SocketTimeoutException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ImdbSyncService {

    private static final int DEFAULT_IMDB_LIST_LIMIT = 20;
    private static final int MAX_IMDB_LIST_LIMIT = 100;
    private static final int LANGUAGE_MAX = 50;
    private static final int REGION_MAX = 255;

    private final RestTemplate imdbRestTemplate;
    private final MovieRepository movieRepository;
    private final GenreRepository genreRepository;
    private final CatalogOutboxEventWriter catalogOutboxEventWriter;

    @Value("${imdb.api.base-url:https://api.imdbapi.dev}")
    private String imdbApiBaseUrl;

    @Transactional(readOnly = true)
    public List<ImdbTitleDTO> getTitlesFromImdb(String query, Integer limit) {
        int normalizedLimit = normalizeLimit(limit);
        UriComponentsBuilder uriBuilder = UriComponentsBuilder
                .fromHttpUrl(imdbApiBaseUrl + "/titles")
                .queryParam("limit", normalizedLimit);
        if (query != null && !query.isBlank()) {
            uriBuilder.queryParam("query", query.trim());
        }

        JsonNode body = getJson(uriBuilder.build(true).toUriString(), "IMDb API timeout while fetching title list");
        if (body == null || body.isNull()) {
            return List.of();
        }
        JsonNode titlesNode = unwrapTitleArray(body);
        if (titlesNode == null || !titlesNode.isArray()) {
            return List.of();
        }

        List<ImdbTitleDTO> titles = new ArrayList<>();
        for (JsonNode titleNode : titlesNode) {
            titles.add(toImdbTitleDTO(titleNode));
            if (titles.size() >= normalizedLimit) {
                break;
            }
        }
        return titles;
    }

    @Transactional
    public Movie syncMovieByImdbId(String imdbId) {
        if (imdbId == null || imdbId.isBlank()) {
            throw new IllegalArgumentException("IMDb id must not be blank");
        }
        String normalizedImdbId = imdbId.trim();

        CompletableFuture<JsonNode> titlePayloadFuture = CompletableFuture.supplyAsync(() -> fetchImdbPayload(normalizedImdbId));
        CompletableFuture<JsonNode> akasPayloadFuture = CompletableFuture.supplyAsync(() -> fetchImdbAkasPayload(normalizedImdbId));
        JsonNode payload;
        JsonNode akasPayload;
        try {
            payload = titlePayloadFuture.join();
            akasPayload = akasPayloadFuture.join();
        } catch (CompletionException completionException) {
            Throwable cause = completionException.getCause();
            if (cause instanceof RuntimeException runtimeException) {
                throw runtimeException;
            }
            throw completionException;
        }

        Integer releaseYear = firstInteger(payload, "year", "releaseYear", "startYear", "releaseDate.year");
        Double imdbRating = firstDouble(payload, "rating", "imdbRating", "rating.aggregateRating");
        Integer duration = extractDurationMinutes(payload);
        String genre = firstCsv(payload, "genre", "genres");
        String languageFromTitle = firstCsv(payload, "language", "spokenLanguages", "languages");
        String regionFromTitle = firstCsv(payload, "region", "countriesOfOrigin", "country");
        AkaMetadata akaMetadata = extractAkaMetadata(akasPayload);
        String language = bound(preferNonBlank(akaMetadata.languagesCsv(), languageFromTitle), LANGUAGE_MAX);
        String region = bound(preferNonBlank(akaMetadata.regionsCsv(), regionFromTitle), REGION_MAX);
        String title = firstText(payload, "title", "primaryTitle", "titleText.text", "originalTitle");
        String posterUrl = firstText(payload, "poster", "primaryImage.url", "image.url");
        String director = bound(firstCsv(payload, "director", "directors"), 200);
        String actors = firstCsv(payload, "actors", "cast", "stars");
        String description = firstText(payload, "plot", "plotText.plainText", "description");

        Movie movie = movieRepository.findByImdbId(normalizedImdbId).orElseGet(Movie::new);
        boolean isNew = movie.getId() == null;
        movie.setImdbId(normalizedImdbId);
        if (title != null && !title.isBlank()) {
            movie.setTitle(title.trim());
        }
        if (language != null && !language.isBlank()) {
            movie.setLanguage(language);
        }
        if (region != null && !region.isBlank()) {
            movie.setRegion(region);
        }
        if (director != null && !director.isBlank()) {
            movie.setDirector(director);
        }
        if (actors != null && !actors.isBlank()) {
            movie.setActors(actors);
        }
        if (description != null && !description.isBlank() && (movie.getDescription() == null || movie.getDescription().isBlank())) {
            movie.setDescription(description);
        }
        if (releaseYear != null) {
            movie.setReleaseDate(LocalDate.of(releaseYear, 1, 1));
        } else if (movie.getReleaseDate() == null) {
            movie.setReleaseDate(LocalDate.now().plusDays(1));
        }
        if (imdbRating != null) {
            movie.setImdbRating(imdbRating);
        }
        if (duration != null && duration > 0) {
            movie.setDurationMinutes(duration);
        }
        if (posterUrl != null && !posterUrl.isBlank() && (movie.getPosterUrl() == null || movie.getPosterUrl().isBlank())) {
            movie.setPosterUrl(posterUrl);
        }
        if (genre != null && !genre.isBlank()) {
            movie.setGenres(resolveGenres(genre));
        } else if (movie.getGenres() == null) {
            movie.setGenres(new HashSet<>());
        }
        if (movie.getTitle() == null || movie.getTitle().isBlank()) {
            movie.setTitle("IMDb " + normalizedImdbId);
        }
        if (movie.getDurationMinutes() == null || movie.getDurationMinutes() <= 0) {
            movie.setDurationMinutes(90);
        }
        if (movie.getAgeRating() == null || movie.getAgeRating().isBlank()) {
            movie.setAgeRating("P");
        }
        movie.setActive(true);

        Movie saved = movieRepository.save(movie);
        if (isNew) {
            catalogOutboxEventWriter.movieCreated(saved);
        } else {
            catalogOutboxEventWriter.movieUpdated(saved);
        }
        return saved;
    }

    public int clampListLimit(Integer limit) {
        return normalizeLimit(limit);
    }

    private Set<Genre> resolveGenres(String csv) {
        Set<Genre> genres = new HashSet<>();
        for (String raw : csv.split(",")) {
            String name = raw == null ? "" : raw.trim();
            if (name.isBlank()) {
                continue;
            }
            if (name.length() > 50) {
                name = name.substring(0, 50).trim();
            }
            if (name.isBlank()) {
                continue;
            }
            String genreName = name;
            Genre genre = genreRepository.findByNameIgnoreCase(genreName)
                    .orElseGet(() -> genreRepository.save(Genre.builder().name(genreName).build()));
            genres.add(genre);
        }
        return genres;
    }

    private JsonNode fetchImdbAkasPayload(String imdbId) {
        String requestUrl = imdbApiBaseUrl + "/titles/" + imdbId + "/akas";
        try {
            ResponseEntity<JsonNode> response = imdbRestTemplate.getForEntity(requestUrl, JsonNode.class);
            return response.getBody();
        } catch (HttpClientErrorException.NotFound notFoundException) {
            return null;
        } catch (RestClientException restClientException) {
            throw translate(restClientException, "IMDb API timeout while fetching AKAs for movie: " + imdbId);
        }
    }

    private JsonNode fetchImdbPayload(String imdbId) {
        String requestUrl = imdbApiBaseUrl + "/titles/" + imdbId;
        try {
            ResponseEntity<JsonNode> response = imdbRestTemplate.getForEntity(requestUrl, JsonNode.class);
            JsonNode body = response.getBody();
            if (body == null || body.isNull()) {
                throw new CustomException("IMDb API returned empty payload", HttpStatus.BAD_GATEWAY, "IMDB_EMPTY");
            }
            return body;
        } catch (HttpClientErrorException.NotFound notFoundException) {
            throw new CustomException("IMDb movie not found for id: " + imdbId, HttpStatus.NOT_FOUND, "IMDB_NOT_FOUND");
        } catch (RestClientException restClientException) {
            throw translate(restClientException, "IMDb API timeout while syncing movie: " + imdbId);
        }
    }

    private JsonNode getJson(String url, String timeoutMessage) {
        try {
            ResponseEntity<JsonNode> response = imdbRestTemplate.getForEntity(url, JsonNode.class);
            return response.getBody();
        } catch (RestClientException restClientException) {
            throw translate(restClientException, timeoutMessage);
        }
    }

    private CustomException translate(RestClientException exception, String timeoutMessage) {
        if (exception instanceof ResourceAccessException resourceAccessException) {
            Throwable rootCause = resourceAccessException.getMostSpecificCause();
            if (rootCause instanceof SocketTimeoutException) {
                return new CustomException(timeoutMessage, HttpStatus.GATEWAY_TIMEOUT, "IMDB_TIMEOUT");
            }
            return new CustomException("Cannot access IMDb API: " + resourceAccessException.getMessage(), HttpStatus.BAD_GATEWAY, "IMDB_UNAVAILABLE");
        }
        return new CustomException("IMDb API error: " + exception.getMessage(), HttpStatus.BAD_GATEWAY, "IMDB_ERROR");
    }

    private JsonNode unwrapTitleArray(JsonNode body) {
        if (body.isArray()) {
            return body;
        }
        String[] arrayPaths = {"titles", "results", "data", "items", "content"};
        for (String path : arrayPaths) {
            JsonNode node = body.get(path);
            if (node != null && node.isArray()) {
                return node;
            }
        }
        JsonNode nestedData = body.get("data");
        if (nestedData != null && nestedData.isObject()) {
            for (String path : arrayPaths) {
                JsonNode node = nestedData.get(path);
                if (node != null && node.isArray()) {
                    return node;
                }
            }
        }
        return null;
    }

    private ImdbTitleDTO toImdbTitleDTO(JsonNode node) {
        return ImdbTitleDTO.builder()
                .imdbId(firstText(node, "id", "imdbId", "tconst"))
                .title(firstText(node, "title", "primaryTitle", "titleText.text", "originalTitle"))
                .releaseYear(firstInteger(node, "year", "releaseYear", "startYear", "releaseDate.year"))
                .imdbRating(firstDouble(node, "rating", "imdbRating", "rating.aggregateRating"))
                .genre(firstCsv(node, "genre", "genres"))
                .region(firstCsv(node, "region", "countriesOfOrigin", "country"))
                .language(firstCsv(node, "language", "spokenLanguages", "languages"))
                .duration(extractDurationMinutes(node))
                .posterUrl(firstText(node, "poster", "primaryImage.url", "image.url"))
                .build();
    }

    private AkaMetadata extractAkaMetadata(JsonNode akasPayload) {
        if (akasPayload == null || akasPayload.isNull()) {
            return new AkaMetadata(null, null);
        }
        JsonNode akasNode = unwrapAkasArray(akasPayload);
        if (akasNode == null || !akasNode.isArray()) {
            return new AkaMetadata(null, null);
        }
        Set<String> regions = new LinkedHashSet<>();
        Set<String> languages = new LinkedHashSet<>();
        for (JsonNode akaNode : akasNode) {
            String region = firstText(akaNode, "country.code", "country");
            String language = firstText(akaNode, "language.name", "language");
            if (region != null && !region.isBlank()) {
                regions.add(region.trim());
            }
            if (language != null && !language.isBlank()) {
                languages.add(language.trim());
            }
        }
        return new AkaMetadata(joinValuesWithinLimit(regions, REGION_MAX), joinValuesWithinLimit(languages, LANGUAGE_MAX));
    }

    private JsonNode unwrapAkasArray(JsonNode akasPayload) {
        if (akasPayload.isArray()) {
            return akasPayload;
        }
        JsonNode akasNode = akasPayload.get("akas");
        if (akasNode != null && akasNode.isArray()) {
            return akasNode;
        }
        JsonNode dataNode = akasPayload.get("data");
        if (dataNode != null && dataNode.isObject()) {
            JsonNode nestedAkasNode = dataNode.get("akas");
            if (nestedAkasNode != null && nestedAkasNode.isArray()) {
                return nestedAkasNode;
            }
        }
        return null;
    }

    private String preferNonBlank(String preferredValue, String fallbackValue) {
        if (preferredValue != null && !preferredValue.isBlank()) {
            return preferredValue;
        }
        if (fallbackValue != null && !fallbackValue.isBlank()) {
            return fallbackValue;
        }
        return null;
    }

    private String bound(String value, int maxLength) {
        if (value == null || value.isBlank() || maxLength <= 0) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.length() <= maxLength ? trimmed : trimmed.substring(0, maxLength).trim();
    }

    private String joinValuesWithinLimit(Set<String> values, int maxLength) {
        if (values == null || values.isEmpty() || maxLength <= 0) {
            return null;
        }
        StringBuilder builder = new StringBuilder();
        for (String rawValue : values) {
            if (rawValue == null) {
                continue;
            }
            String value = rawValue.trim();
            if (value.isBlank()) {
                continue;
            }
            int separatorLength = builder.isEmpty() ? 0 : 2;
            int availableLength = maxLength - builder.length() - separatorLength;
            if (availableLength <= 0) {
                break;
            }
            String boundedValue = value.length() > availableLength ? value.substring(0, availableLength).trim() : value;
            if (boundedValue.isBlank()) {
                break;
            }
            if (!builder.isEmpty()) {
                builder.append(", ");
            }
            builder.append(boundedValue);
        }
        return builder.isEmpty() ? null : builder.toString();
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return DEFAULT_IMDB_LIST_LIMIT;
        }
        return Math.min(limit, MAX_IMDB_LIST_LIMIT);
    }

    private Integer extractDurationMinutes(JsonNode payload) {
        Integer directMinutes = firstInteger(payload, "duration", "runtimeMinutes", "runtime");
        if (directMinutes != null && directMinutes > 0) {
            return directMinutes;
        }
        Integer runtimeSeconds = firstInteger(payload, "runtimeSeconds");
        if (runtimeSeconds != null && runtimeSeconds > 0) {
            return Math.max(1, runtimeSeconds / 60);
        }
        return null;
    }

    private Integer firstInteger(JsonNode payload, String... paths) {
        for (String path : paths) {
            JsonNode node = findNode(payload, path);
            if (node != null && node.isNumber()) {
                return node.intValue();
            }
            if (node != null && node.isTextual()) {
                try {
                    return Integer.parseInt(node.asText().trim());
                } catch (NumberFormatException ignored) {
                    // try the next path
                }
            }
        }
        return null;
    }

    private Double firstDouble(JsonNode payload, String... paths) {
        for (String path : paths) {
            JsonNode node = findNode(payload, path);
            if (node != null && node.isNumber()) {
                return node.doubleValue();
            }
            if (node != null && node.isTextual()) {
                try {
                    return Double.parseDouble(node.asText().trim());
                } catch (NumberFormatException ignored) {
                    // try the next path
                }
            }
        }
        return null;
    }

    private String firstText(JsonNode payload, String... paths) {
        for (String path : paths) {
            JsonNode node = findNode(payload, path);
            if (node != null && node.isTextual()) {
                String value = node.asText().trim();
                if (!value.isBlank()) {
                    return value;
                }
            }
        }
        return null;
    }

    private String firstCsv(JsonNode payload, String... paths) {
        for (String path : paths) {
            JsonNode node = findNode(payload, path);
            if (node == null || node.isNull()) {
                continue;
            }
            if (node.isTextual()) {
                String value = node.asText().trim();
                if (!value.isBlank()) {
                    return value;
                }
            }
            if (node.isArray()) {
                List<String> values = new ArrayList<>();
                node.forEach(item -> {
                    if (item.isTextual()) {
                        values.add(item.asText());
                        return;
                    }
                    JsonNode nameNode = item.get("name");
                    if (nameNode != null && nameNode.isTextual()) {
                        values.add(nameNode.asText());
                        return;
                    }
                    JsonNode textNode = item.get("text");
                    if (textNode != null && textNode.isTextual()) {
                        values.add(textNode.asText());
                    }
                });
                String csv = values.stream()
                        .filter(Objects::nonNull)
                        .map(String::trim)
                        .filter(value -> !value.isBlank())
                        .distinct()
                        .collect(Collectors.joining(", "));
                if (!csv.isBlank()) {
                    return csv;
                }
            }
        }
        return null;
    }

    private JsonNode findNode(JsonNode payload, String path) {
        if (payload == null || payload.isNull() || path == null || path.isBlank()) {
            return null;
        }
        JsonNode current = payload;
        for (String segment : path.split("\\.")) {
            if (current == null || current.isNull()) {
                return null;
            }
            current = current.get(segment);
        }
        return current;
    }

    private record AkaMetadata(String regionsCsv, String languagesCsv) {
    }
}
