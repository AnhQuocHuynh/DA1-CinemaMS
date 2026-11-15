package com.uit.cinema.recommendation.client;

import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.recommendation.uncertainty.MovieFeature;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.List;

@Component
public class HttpCatalogFeatureClient implements CatalogFeatureClient {

    private final RestClient restClient;

    public HttpCatalogFeatureClient(
            RestClient.Builder builder,
            @Value("${services.catalog.url:http://localhost:8081}") String catalogBaseUrl,
            @Value("${app.internal-token:local-dev-internal-token}") String internalToken
    ) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(800));
        factory.setReadTimeout(Duration.ofSeconds(3));
        this.restClient = builder
                .requestFactory(factory)
                .baseUrl(catalogBaseUrl)
                .defaultHeader("X-Internal-Token", internalToken)
                .build();
    }

    @Override
    public List<MovieFeature> loadAll() {
        try {
            ApiResponse<List<MovieFeature>> response = restClient.get()
                    .uri("/internal/catalog/movies/features")
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            if (response == null || response.data() == null) {
                return List.of();
            }
            return response.data();
        } catch (RestClientException exception) {
            throw unavailable(exception);
        }
    }

    @Override
    public MovieFeature requireFeature(Long movieId) {
        if (movieId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "MOVIE_ID_REQUIRED");
        }
        try {
            ApiResponse<MovieFeature> response = restClient.get()
                    .uri("/internal/catalog/movies/{movieId}/feature", movieId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            if (response == null || response.data() == null || response.data().id() == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "MOVIE_NOT_FOUND");
            }
            return response.data();
        } catch (RestClientResponseException exception) {
            HttpStatusCode status = exception.getStatusCode();
            if (status.value() == HttpStatus.NOT_FOUND.value()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "MOVIE_NOT_FOUND");
            }
            throw unavailable(exception);
        } catch (RestClientException exception) {
            throw unavailable(exception);
        }
    }

    private ResponseStatusException unavailable(RestClientException exception) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "CATALOG_UNAVAILABLE", exception);
    }
}
