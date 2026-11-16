package com.uit.cinema.chatbot.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.uit.cinema.chatbot.service.RecommendationKnowledgeClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;

@Slf4j
@Component
public class HttpRecommendationKnowledgeClient implements RecommendationKnowledgeClient {

    private final RestClient recommendationRestClient;

    public HttpRecommendationKnowledgeClient(@Qualifier("recommendationRestClient") RestClient recommendationRestClient) {
        this.recommendationRestClient = recommendationRestClient;
    }

    @Override
    public List<String> popularLines() {
        try {
            JsonNode body = recommendationRestClient.get()
                .uri("/api/recommendations/movies/popular?limit=5")
                .retrieve()
                .body(JsonNode.class);
            return UpstreamJson.popular(body);
        } catch (RestClientException ex) {
            log.warn("Recommendation read failed: {}", ex.getClass().getSimpleName());
            return List.of();
        }
    }
}
