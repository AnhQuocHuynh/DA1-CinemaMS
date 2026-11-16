package com.uit.cinema.chatbot.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.uit.cinema.chatbot.config.CinemaAiProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class GeminiEmbeddingClient implements EmbeddingPort {

    private final RestClient geminiRestClient;
    private final CinemaAiProperties properties;

    public GeminiEmbeddingClient(
        @Qualifier("geminiRestClient") RestClient geminiRestClient,
        CinemaAiProperties properties
    ) {
        this.geminiRestClient = geminiRestClient;
        this.properties = properties;
    }

    @Override
    public boolean available() {
        return properties.ready();
    }

    @Override
    public float[] embed(String text) {
        List<float[]> vectors = embedAll(List.of(text));
        return vectors.get(0);
    }

    @Override
    public List<float[]> embedAll(List<String> texts) {
        if (!available()) {
            throw new IllegalStateException("Embedding is disabled");
        }
        if (texts == null || texts.isEmpty()) {
            return List.of();
        }
        try {
            JsonNode body = geminiRestClient.post()
                .uri("/models/{model}:batchEmbedContents", properties.getEmbeddingModel())
                .header("x-goog-api-key", properties.getApiKey())
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody(texts))
                .retrieve()
                .body(JsonNode.class);
            return readVectors(body, texts.size());
        } catch (RestClientException ex) {
            log.warn("Gemini embedding request failed: {}", ex.getClass().getSimpleName());
            throw ex;
        }
    }

    private Map<String, Object> requestBody(List<String> texts) {
        List<Map<String, Object>> requests = new ArrayList<>();
        for (String text : texts) {
            requests.add(Map.of(
                "model", "models/" + properties.getEmbeddingModel(),
                "content", Map.of("parts", List.of(Map.of("text", text == null ? "" : text))),
                "outputDimensionality", EmbeddingDimensions.LENGTH
            ));
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("requests", requests);
        return body;
    }

    private List<float[]> readVectors(JsonNode body, int expected) {
        JsonNode embeddings = body == null ? null : body.path("embeddings");
        if (embeddings == null || !embeddings.isArray() || embeddings.size() != expected) {
            throw new IllegalStateException("Embedding response size mismatch");
        }
        List<float[]> vectors = new ArrayList<>();
        for (JsonNode embedding : embeddings) {
            JsonNode values = embedding.path("values");
            float[] vector = new float[values.size()];
            for (int i = 0; i < values.size(); i++) {
                vector[i] = (float) values.get(i).asDouble();
            }
            EmbeddingDimensions.check(vector);
            vectors.add(vector);
        }
        return vectors;
    }
}
