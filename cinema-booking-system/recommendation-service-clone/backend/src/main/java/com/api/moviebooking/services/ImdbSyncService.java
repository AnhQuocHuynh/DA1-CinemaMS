package com.api.moviebooking.services;

import java.net.SocketTimeoutException;
import java.time.Year;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import com.api.moviebooking.helpers.exceptions.CustomException;
import com.api.moviebooking.helpers.exceptions.ResourceNotFoundException;
import com.api.moviebooking.models.dtos.imdb.ImdbTitleDTO;
import com.api.moviebooking.models.entities.Movie;
import com.api.moviebooking.models.enums.MovieStatus;
import com.api.moviebooking.repositories.MovieRepo;
import com.fasterxml.jackson.databind.JsonNode;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ImdbSyncService {

    private static final int DEFAULT_IMDB_LIST_LIMIT = 20;
    private static final int MAX_IMDB_LIST_LIMIT = 100;
    private static final int DEFAULT_VARCHAR_LENGTH = 255;

    private final RestTemplate restTemplate;
    private final MovieRepo movieRepo;

    @Value("${imdb.api.base-url:https://api.imdbapi.dev}")
    private String imdbApiBaseUrl;

    // Get a list of IMDb titles based on an optional search query, with a specified limit on the number of results.
    @Transactional(readOnly = true)
    public List<ImdbTitleDTO> getTitlesFromImdb(String query, Integer limit) {
        int normalizedLimit = normalizeLimit(limit);

        UriComponentsBuilder uriBuilder = UriComponentsBuilder
                .fromHttpUrl(imdbApiBaseUrl + "/titles")
                .queryParam("limit", normalizedLimit);

        if (query != null && !query.isBlank()) {
            uriBuilder.queryParam("query", query.trim());
        }

        try {
            ResponseEntity<JsonNode> response = restTemplate.getForEntity(
                    uriBuilder.build(true).toUri(),
                    JsonNode.class);

            JsonNode body = response.getBody();
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
        } catch (ResourceAccessException resourceAccessException) {
            Throwable rootCause = resourceAccessException.getMostSpecificCause();
            if (rootCause instanceof SocketTimeoutException) {
                throw new CustomException("IMDb API timeout while fetching title list", HttpStatus.GATEWAY_TIMEOUT);
            }
            throw new CustomException("Cannot access IMDb API: " + resourceAccessException.getMessage(),
                    HttpStatus.BAD_GATEWAY);
        } catch (RestClientException restClientException) {
            throw new CustomException("IMDb API error: " + restClientException.getMessage(), HttpStatus.BAD_GATEWAY);
        }
    }

    // Sync movie metadata from IMDb by its IMDb ID and upsert into the movies database.
    @Transactional
    public Movie syncMovieByImdbId(String imdbId) {
        if (imdbId == null || imdbId.isBlank()) {
            throw new IllegalArgumentException("IMDb id must not be blank");
        }

        String normalizedImdbId = imdbId.trim();

        CompletableFuture<JsonNode> titlePayloadFuture = CompletableFuture
                .supplyAsync(() -> fetchImdbPayload(normalizedImdbId));
        CompletableFuture<JsonNode> akasPayloadFuture = CompletableFuture
                .supplyAsync(() -> fetchImdbAkasPayload(normalizedImdbId));

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
        String languageFromTitlePayload = firstCsv(payload, "language", "spokenLanguages", "languages");
        String regionFromTitlePayload = firstCsv(payload, "region", "countriesOfOrigin", "country");
        AkaMetadata akaMetadata = extractAkaMetadata(akasPayload);
        String language = normalizeCsvForStorage(preferNonBlank(akaMetadata.languagesCsv(), languageFromTitlePayload));
        String region = normalizeCsvForStorage(preferNonBlank(akaMetadata.regionsCsv(), regionFromTitlePayload));
        String title = firstText(payload, "title", "primaryTitle", "titleText.text", "originalTitle");
        String posterUrl = firstText(payload, "poster", "primaryImage.url", "image.url");

        Movie movie = movieRepo.findByImdbId(normalizedImdbId).orElseGet(Movie::new);

        movie.setImdbId(normalizedImdbId);
        if (title != null && !title.isBlank()) {
            movie.setTitle(title.trim());
        }
        if (genre != null && !genre.isBlank()) {
            movie.setGenre(genre);
        }
        if (language != null && !language.isBlank()) {
            movie.setLanguage(language);
        }
        if (region != null && !region.isBlank()) {
            movie.setRegion(region);
        }
        if (releaseYear != null) {
            movie.setReleaseYear(releaseYear);
            movie.setStatus(resolveMovieStatus(releaseYear));
        }
        if (imdbRating != null) {
            movie.setImdbRating(imdbRating);
        }
        if (duration != null && duration > 0) {
            movie.setDuration(duration);
        }
        if (posterUrl != null && !posterUrl.isBlank() && (movie.getPosterUrl() == null || movie.getPosterUrl().isBlank())) {
            movie.setPosterUrl(posterUrl);
        }

        // Ensure required DB fields always have valid values when creating new rows.
        if (movie.getTitle() == null || movie.getTitle().isBlank()) {
            movie.setTitle("IMDb " + normalizedImdbId);
        }
        if (movie.getDuration() <= 0) {
            movie.setDuration(duration != null && duration > 0 ? duration : 90);
        }
        if (movie.getMinimumAge() < 0) {
            movie.setMinimumAge(0);
        }
        if (movie.getStatus() == null) {
            movie.setStatus(MovieStatus.UPCOMING);
        }

        return movieRepo.save(movie);
    }

    private JsonNode fetchImdbAkasPayload(String imdbId) {
        String requestUrl = String.format("%s/titles/%s/akas", imdbApiBaseUrl, imdbId);

        try {
            ResponseEntity<JsonNode> response = restTemplate.getForEntity(requestUrl, JsonNode.class);
            return response.getBody();
        } catch (HttpClientErrorException.NotFound notFoundException) {
            return null;
        } catch (ResourceAccessException resourceAccessException) {
            Throwable rootCause = resourceAccessException.getMostSpecificCause();
            if (rootCause instanceof SocketTimeoutException) {
                throw new CustomException("IMDb API timeout while fetching AKAs for movie: " + imdbId,
                        HttpStatus.GATEWAY_TIMEOUT);
            }
            throw new CustomException("Cannot access IMDb API AKAs endpoint: " + resourceAccessException.getMessage(),
                    HttpStatus.BAD_GATEWAY);
        } catch (RestClientException restClientException) {
            throw new CustomException("IMDb API AKAs error: " + restClientException.getMessage(),
                    HttpStatus.BAD_GATEWAY);
        }
    }

    private JsonNode fetchImdbPayload(String imdbId) {
        String requestUrl = String.format("%s/titles/%s", imdbApiBaseUrl, imdbId);

        try {
            ResponseEntity<JsonNode> response = restTemplate.getForEntity(requestUrl, JsonNode.class);
            JsonNode body = response.getBody();
            if (body == null || body.isNull()) {
                throw new CustomException("IMDb API returned empty payload", HttpStatus.BAD_GATEWAY);
            }
            return body;
        } catch (HttpClientErrorException.NotFound notFoundException) {
            throw new ResourceNotFoundException("IMDb movie not found for id: " + imdbId);
        } catch (ResourceAccessException resourceAccessException) {
            Throwable rootCause = resourceAccessException.getMostSpecificCause();
            if (rootCause instanceof SocketTimeoutException) {
                throw new CustomException("IMDb API timeout while syncing movie: " + imdbId, HttpStatus.GATEWAY_TIMEOUT);
            }
            throw new CustomException("Cannot access IMDb API: " + resourceAccessException.getMessage(),
                    HttpStatus.BAD_GATEWAY);
        } catch (RestClientException restClientException) {
            throw new CustomException("IMDb API error: " + restClientException.getMessage(), HttpStatus.BAD_GATEWAY);
        }
    }

    private JsonNode unwrapTitleArray(JsonNode body) {
        if (body.isArray()) {
            return body;
        }

        String[] arrayPaths = { "titles", "results", "data", "items", "content" };
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

        String regionCsv = joinValuesWithinLimit(regions, DEFAULT_VARCHAR_LENGTH);
        String languageCsv = joinValuesWithinLimit(languages, DEFAULT_VARCHAR_LENGTH);

        return new AkaMetadata(regionCsv, languageCsv);
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

    private String normalizeCsvForStorage(String rawCsv) {
        if (rawCsv == null || rawCsv.isBlank()) {
            return null;
        }

        Set<String> uniqueValues = new LinkedHashSet<>();
        for (String token : rawCsv.split(",")) {
            String value = token == null ? null : token.trim();
            if (value != null && !value.isBlank()) {
                uniqueValues.add(value);
            }
        }

        return joinValuesWithinLimit(uniqueValues, DEFAULT_VARCHAR_LENGTH);
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

            int separatorLength = builder.length() == 0 ? 0 : 2;
            int availableLength = maxLength - builder.length() - separatorLength;
            if (availableLength <= 0) {
                break;
            }

            String boundedValue = value.length() > availableLength ? value.substring(0, availableLength).trim() : value;
            if (boundedValue.isBlank()) {
                break;
            }

            if (builder.length() > 0) {
                builder.append(", ");
            }
            builder.append(boundedValue);

            if (builder.length() >= maxLength) {
                break;
            }
        }

        return builder.length() == 0 ? null : builder.toString();
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

    private MovieStatus resolveMovieStatus(Integer releaseYear) {
        if (releaseYear == null) {
            return MovieStatus.UPCOMING;
        }
        int currentYear = Year.now().getValue();
        return releaseYear <= currentYear ? MovieStatus.SHOWING : MovieStatus.UPCOMING;
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
        String[] segments = path.split("\\.");
        for (String segment : segments) {
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
