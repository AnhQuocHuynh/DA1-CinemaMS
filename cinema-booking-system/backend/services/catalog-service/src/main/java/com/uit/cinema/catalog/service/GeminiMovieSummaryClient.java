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

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class GeminiMovieSummaryClient implements MovieSummaryAgent {

    static final int MAX_SUMMARY_LENGTH = 2000;

    private static final Set<String> STOPWORDS = Set.of(
        "movie", "movies", "phim", "film", "films", "anime",
        "the", "and", "with", "for", "from", "this", "that", "into", "onto",
        "cua", "voi", "mot", "nay", "cho", "trong", "nhung", "duoc", "phan", "tap",
        "tan", "new", "vol", "episode", "official", "trailer", "poster"
    );

    private static final String SYSTEM_PROMPT = """
        You write a short factual synopsis for a cinema website.
        The description may be only a title hint, not a full plot. Identify the real film from the title and description, then use well-known public facts about that film.
        Rules:
        1. Write 3 to 5 complete sentences in the same language as the description.
        2. Include the film title.
        3. Mention concrete names, places, or events from that film.
        4. Do not write a generic story about protagonists, rivalries, catastrophes, or the human spirit.
        5. If you are not confident which film this is, restate only the supplied title and description in 1 or 2 sentences and add no plot.
        6. Plain text only. No markdown, labels, or quotation marks.
        """;

    private final RestClient geminiRestClient;
    private final CinemaAiProperties properties;

    @Override
    public Optional<String> summarize(String title, String description, List<String> genres) {
        if (!properties.isEnabled() || properties.getApiKey() == null || properties.getApiKey().isBlank()) {
            return Optional.empty();
        }
        ModelCall first = requestText(userPrompt(title, description, genres));
        if (mentionsSource(first.text(), title, description)) {
            return Optional.of(first.text());
        }
        if (first.transportFailed()) {
            return Optional.empty();
        }
        log.info("Movie summary did not mention the supplied film, retrying once");
        ModelCall second = requestText(retryPrompt(title, description, genres));
        if (mentionsSource(second.text(), title, description)) {
            return Optional.of(second.text());
        }
        log.warn("Movie summary still ignored the supplied film");
        return Optional.empty();
    }

    private ModelCall requestText(String userText) {
        try {
            JsonNode body = geminiRestClient.post()
                .uri("/models/{model}:generateContent", properties.getModel())
                .header("x-goog-api-key", properties.getApiKey())
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody(userText))
                .retrieve()
                .body(JsonNode.class);
            return new ModelCall(limitSummary(cleanSummary(extractText(body))), false);
        } catch (RestClientResponseException ex) {
            log.warn("Gemini summary request failed: status {}", ex.getStatusCode().value());
            return new ModelCall(null, true);
        } catch (RestClientException ex) {
            log.warn("Gemini summary request failed: {}", ex.getClass().getSimpleName());
            return new ModelCall(null, true);
        }
    }

    private record ModelCall(String text, boolean transportFailed) {
    }

    private Map<String, Object> requestBody(String userText) {
        return Map.of(
            "systemInstruction", Map.of("parts", List.of(Map.of("text", SYSTEM_PROMPT))),
            "contents", List.of(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", userText))
            )),
            "generationConfig", Map.of(
                "maxOutputTokens", 512,
                "thinkingConfig", Map.of("thinkingLevel", "low")
            )
        );
    }

    private static String userPrompt(String title, String description, List<String> genres) {
        String genreLine = genres == null || genres.isEmpty() ? "None" : String.join(", ", genres);
        return """
            Title: %s
            Genres: %s
            Description:
            %s
            """.formatted(title == null ? "" : title, genreLine, description);
    }

    private static String retryPrompt(String title, String description, List<String> genres) {
        List<String> terms = significantTerms(title, description);
        String required = terms.isEmpty() ? title == null ? "" : title : String.join(", ", terms.stream().limit(8).toList());
        return """
            The previous summary was rejected because it did not refer to this film.
            Write the summary again. It must include at least one of these terms: %s
            Keep the same language as the description. Write 3 to 5 sentences. Do not use generic filler.
            %s
            """.formatted(required, userPrompt(title, description, genres));
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

    static boolean mentionsSource(String summary, String title, String description) {
        if (summary == null || summary.isBlank()) {
            return false;
        }
        String haystack = normalizeForMatch(summary);
        List<String> terms = significantTerms(title, description);
        if (terms.isEmpty()) {
            String normalizedTitle = normalizeForMatch(title == null ? "" : title).trim();
            return normalizedTitle.length() < 3 || haystack.contains(normalizedTitle);
        }
        for (String term : terms) {
            if (haystack.contains(term)) {
                return true;
            }
        }
        return false;
    }

    static List<String> significantTerms(String title, String description) {
        List<String> words = tokens((title == null ? "" : title) + " " + (description == null ? "" : description));
        List<String> terms = new ArrayList<>();
        for (int i = 0; i < words.size(); i++) {
            String word = words.get(i);
            if (word.length() >= 4 && !STOPWORDS.contains(word) && !terms.contains(word)) {
                terms.add(word);
            }
            if (i + 1 < words.size()) {
                String next = words.get(i + 1);
                if (word.length() >= 3 && next.length() >= 3
                    && !STOPWORDS.contains(word) && !STOPWORDS.contains(next)) {
                    String phrase = word + " " + next;
                    if (!terms.contains(phrase)) {
                        terms.add(phrase);
                    }
                }
            }
        }
        return terms;
    }

    private static List<String> tokens(String text) {
        String normalized = normalizeForMatch(text);
        List<String> tokens = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (int i = 0; i < normalized.length(); i++) {
            char c = normalized.charAt(i);
            if (Character.isLetterOrDigit(c)) {
                current.append(c);
            } else if (!current.isEmpty()) {
                tokens.add(current.toString());
                current.setLength(0);
            }
        }
        if (!current.isEmpty()) {
            tokens.add(current.toString());
        }
        return tokens;
    }

    static String normalizeForMatch(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        String lower = value.toLowerCase(Locale.ROOT).replace('đ', 'd');
        String decomposed = Normalizer.normalize(lower, Normalizer.Form.NFD);
        StringBuilder stripped = new StringBuilder(decomposed.length());
        for (int i = 0; i < decomposed.length(); i++) {
            char c = decomposed.charAt(i);
            if (Character.getType(c) != Character.NON_SPACING_MARK) {
                stripped.append(c);
            }
        }
        return stripped.toString();
    }

    static String cleanSummary(String text) {
        if (text == null) {
            return null;
        }
        String cleaned = text.strip();
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
