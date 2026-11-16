package com.uit.cinema.chatbot.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.uit.cinema.chatbot.service.CatalogDocument;
import com.uit.cinema.chatbot.service.CatalogKnowledgeClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;

@Slf4j
@Component
public class HttpCatalogKnowledgeClient implements CatalogKnowledgeClient {

    private final RestClient catalogRestClient;

    public HttpCatalogKnowledgeClient(@Qualifier("catalogRestClient") RestClient catalogRestClient) {
        this.catalogRestClient = catalogRestClient;
    }

    @Override
    public List<CatalogDocument> listMovies() {
        return UpstreamJson.movies(read("/api/movies"));
    }

    @Override
    public List<CatalogDocument> listEvents() {
        return UpstreamJson.events(read("/api/events"));
    }

    private JsonNode read(String path) {
        try {
            return catalogRestClient.get().uri(path).retrieve().body(JsonNode.class);
        } catch (RestClientException ex) {
            log.warn("Catalog read failed for {}: {}", path, ex.getClass().getSimpleName());
            throw ex;
        }
    }
}
