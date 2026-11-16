package com.uit.cinema.chatbot.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uit.cinema.chatbot.config.CinemaAiProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

@Slf4j
@Component
public class GeminiChatClient implements LanguageModelPort {

    private final RestClient geminiRestClient;
    private final CinemaAiProperties properties;
    private final ObjectMapper objectMapper;

    public GeminiChatClient(
        @Qualifier("geminiRestClient") RestClient geminiRestClient,
        CinemaAiProperties properties,
        ObjectMapper objectMapper
    ) {
        this.geminiRestClient = geminiRestClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean available() {
        return properties.ready();
    }

    @Override
    public String complete(String systemPrompt, String userPrompt) {
        if (!available()) {
            throw new IllegalStateException("Chat model is disabled");
        }
        try {
            JsonNode body = geminiRestClient.post()
                .uri("/models/{model}:generateContent", properties.getModel())
                .header("x-goog-api-key", properties.getApiKey())
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody(systemPrompt, userPrompt))
                .retrieve()
                .body(JsonNode.class);
            return GeminiSseParser.textFromChunk(body);
        } catch (RestClientException ex) {
            log.warn("Gemini chat request failed: {}", ex.getClass().getSimpleName());
            throw ex;
        }
    }

    @Override
    public void stream(String systemPrompt, String userPrompt, Consumer<String> tokens) {
        if (!available()) {
            throw new IllegalStateException("Chat model is disabled");
        }
        Duration timeout = properties.getTimeout() == null ? Duration.ofSeconds(30) : properties.getTimeout();
        try {
            String payload = objectMapper.writeValueAsString(requestBody(systemPrompt, userPrompt));
            URI uri = URI.create(trimSlash(properties.getBaseUrl())
                + "/models/" + properties.getModel() + ":streamGenerateContent?alt=sse");
            HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(timeout)
                .header("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .header("x-goog-api-key", properties.getApiKey())
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();
            HttpClient client = HttpClient.newBuilder().connectTimeout(timeout).build();
            HttpResponse<java.io.InputStream> response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("Gemini stream request failed: status {}", response.statusCode());
                throw new RestClientException("Gemini stream status " + response.statusCode());
            }
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
                GeminiSseParser.readTokens(reader, objectMapper, tokens);
            }
        } catch (RestClientException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("Gemini stream request failed: {}", ex.getClass().getSimpleName());
            throw new RestClientException("Gemini stream failed", ex);
        }
    }

    private Map<String, Object> requestBody(String systemPrompt, String userPrompt) {
        return Map.of(
            "systemInstruction", Map.of("parts", List.of(Map.of("text", systemPrompt == null ? "" : systemPrompt))),
            "contents", List.of(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", userPrompt == null ? "" : userPrompt))
            )),
            "generationConfig", Map.of(
                "maxOutputTokens", 1024,
                "thinkingConfig", Map.of("thinkingLevel", "minimal")
            )
        );
    }

    private static String trimSlash(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            return "https://generativelanguage.googleapis.com/v1beta";
        }
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }
}
