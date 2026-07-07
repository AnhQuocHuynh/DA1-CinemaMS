package com.uit.cinema.showtime.client;

import com.uit.cinema.catalog.service.CatalogReadService;
import com.uit.cinema.catalog.service.contract.CatalogContentView;
import com.uit.cinema.core.dto.response.ApiResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Optional;

@Component
public class HttpCatalogReadService implements CatalogReadService {

    private final RestClient restClient;

    public HttpCatalogReadService(
        RestClient.Builder builder,
        @Value("${services.catalog.url:http://localhost:8081}") String catalogBaseUrl
    ) {
        this.restClient = builder.baseUrl(catalogBaseUrl).build();
    }

    @Override
    public Optional<CatalogContentView> findMovie(Long movieId) {
        return getContent("/internal/catalog/movies/{id}", movieId);
    }

    @Override
    public Optional<CatalogContentView> findEvent(Long eventId) {
        return getContent("/internal/catalog/events/{id}", eventId);
    }

    @Override
    public boolean movieExists(Long movieId) {
        return findMovie(movieId).isPresent();
    }

    @Override
    public boolean eventExists(Long eventId) {
        return findEvent(eventId).isPresent();
    }

    private Optional<CatalogContentView> getContent(String uri, Long id) {
        if (id == null) {
            return Optional.empty();
        }
        try {
            ApiResponse<CatalogContentView> response = restClient.get()
                .uri(uri, id)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<CatalogContentView>>() {});
            return Optional.ofNullable(response).map(ApiResponse::getData);
        } catch (RestClientException ex) {
            return Optional.empty();
        }
    }
}
