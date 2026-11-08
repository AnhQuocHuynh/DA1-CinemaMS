package com.uit.cinema.catalog.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.uit.cinema.catalog.config.CinemaAiProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class GeminiMovieSummaryClient implements MovieSummaryAgent {

    static final int MAX_SUMMARY_LENGTH = 2000;

    private static final String SYSTEM_PROMPT = """
        You are an AI assistant that writes engaging movie summaries for a cinema website.
        Task: Using the provided title, genres, and description, write a rich and captivating synopsis.
        Strict requirements:
        1. Language: MUST be written entirely in English.
        2. Word count: MUST be between 100 and 250 words (aim for around 125 to 150 words).
        3. DO NOT start with prefixes like "Summary:", "AI Summary:", "Plot Summary:", "This movie is about", "In this film", or similar introductory tags. Dive directly into the narrative.
        4. DO NOT truncate sentences or use ellipses (...) to cut off thoughts. Write complete, well-formed sentences.
        5. Base the summary faithfully on the provided facts without hallucinating unmentioned cast or contradictory plot points.
        6. Output plain text only. Do not use markdown, bullet points, or quotation marks.
        """;

    private final RestClient geminiRestClient;
    private final CinemaAiProperties properties;

    @Override
    public Optional<String> summarize(String title, String description, List<String> genres) {
        if (!properties.isEnabled() || properties.getApiKey() == null || properties.getApiKey().isBlank()) {
            return Optional.empty();
        }
        try {
            JsonNode body = geminiRestClient.post()
                .uri("/models/{model}:generateContent", properties.getModel())
                .header("x-goog-api-key", properties.getApiKey())
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody(title, description, genres))
                .retrieve()
                .body(JsonNode.class);
            return Optional.ofNullable(limitSummary(cleanSummary(extractText(body))));
        } catch (RestClientResponseException ex) {
            log.warn("Gemini summary request failed: status {}", ex.getStatusCode().value());
            return Optional.empty();
        } catch (RestClientException ex) {
            log.warn("Gemini summary request failed: {}", ex.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    private Map<String, Object> requestBody(String title, String description, List<String> genres) {
        String genreLine = genres == null || genres.isEmpty() ? "None" : String.join(", ", genres);
        String user = """
            Title: %s
            Genres: %s
            Description:
            %s
            """.formatted(title == null ? "" : title, genreLine, description);
        return Map.of(
            "systemInstruction", Map.of("parts", List.of(Map.of("text", SYSTEM_PROMPT))),
            "contents", List.of(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", user))
            )),
            "generationConfig", Map.of(
                "maxOutputTokens", 768,
                "thinkingConfig", Map.of("thinkingLevel", "low")
            )
        );
    }

    private static String extractText(JsonNode body) {
        if (body == null) {
            return null;
        }
        JsonNode parts = body.path("candidates").path(0).path("content").path("parts");
        if (!parts.isArray()) {
            return null;
        }
        StringBuilder summary = new StringBuilder();
        for (JsonNode part : parts) {
            if (part.path("thought").asBoolean(false)) {
                continue;
            }
            String text = part.path("text").asText("").strip();
            if (text.isEmpty()) {
                continue;
            }
            if (!summary.isEmpty()) {
                summary.append('\n');
            }
            summary.append(text);
        }
        return summary.isEmpty() ? null : summary.toString();
    }

    static String cleanSummary(String text) {
        if (text == null) {
            return null;
        }
        String cleaned = text.strip();
        // Remove prefixes like "AI Summary:", "Plot Summary:", "Summary:", "Tóm tắt AI:", "Tóm tắt:"
        cleaned = cleaned.replaceFirst("^(?i)(ai summary|plot summary|summary|tóm tắt ai|tóm tắt)\\s*:\\s*", "").strip();
        if (cleaned.startsWith("\"") && cleaned.endsWith("\"") && cleaned.length() > 1) {
            cleaned = cleaned.substring(1, cleaned.length() - 1).strip();
        }
        return cleaned.isEmpty() ? null : cleaned;
    }

    static String limitSummary(String text) {
        if (text == null) {
            return null;
        }
        String trimmed = text.strip();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() <= MAX_SUMMARY_LENGTH) {
            return trimmed;
        }
        String cut = trimmed.substring(0, MAX_SUMMARY_LENGTH);
        int lastSentence = Math.max(
            cut.lastIndexOf('.'),
            Math.max(cut.lastIndexOf('!'), Math.max(cut.lastIndexOf('?'), cut.lastIndexOf('。')))
        );
        if (lastSentence >= 400) {
            return cut.substring(0, lastSentence + 1).strip();
        }
        return cut.strip();
    }
}
