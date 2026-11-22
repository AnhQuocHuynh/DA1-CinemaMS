package com.uit.cinema.booking.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uit.cinema.booking.config.CinemaAiProperties;
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
public class GeminiReviewSummaryClient implements ReviewSummaryAgent {

    static final int MAX_SUMMARY_LENGTH = 800;
    static final int MAX_KEYWORDS = 6;
    static final int MAX_KEYWORD_LENGTH = 40;

    private static final Set<String> STOPWORDS = Set.of(
        "movie", "movies", "film", "films", "phim", "review", "reviews",
        "the", "and", "with", "for", "from", "this", "that", "very", "was", "were",
        "cua", "voi", "mot", "nay", "cho", "trong", "nhung", "duoc", "khi", "thi",
        "cac", "nhieu", "rat", "minh", "ban", "toi", "nhu", "khan", "gia", "nguoi", "xem", "rap"
    );

    private static final String SYSTEM_PROMPT = """
        You summarize audience reviews for one cinema title.
        Rules:
        1. Use only the supplied reviews. Do not invent praise, complaints, names, or plot.
        2. Write 2 to 4 complete sentences in the dominant language of the comments. If the comments are Vietnamese, write Vietnamese.
        3. State whether the overall reaction is positive, mixed, or negative, and the concrete reasons given.
        4. Choose 3 to 6 short keywords that appear in the comments, in that same language.
        5. Return only JSON: {"summary":"...","keywords":["..."]}
        6. No markdown, labels, or text outside the JSON object.
        """;

    private final RestClient geminiRestClient;
    private final CinemaAiProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public Optional<ReviewSummaryDraft> summarize(List<ReviewCommentSample> comments) {
        if (!properties.isEnabled() || properties.getApiKey() == null || properties.getApiKey().isBlank()) {
            return Optional.empty();
        }
        if (comments == null || comments.isEmpty()) {
            return Optional.empty();
        }
        ModelCall first = requestText(userPrompt(comments));
        Optional<ReviewSummaryDraft> parsed = parseDraft(first.text(), comments);
        if (parsed.isPresent()) {
            return parsed;
        }
        if (first.transportFailed()) {
            return Optional.empty();
        }
        log.info("Review summary was empty or ungrounded, retrying once");
        ModelCall second = requestText(retryPrompt(comments));
        parsed = parseDraft(second.text(), comments);
        if (parsed.isPresent()) {
            return parsed;
        }
        if (second.transportFailed()) {
            return Optional.empty();
        }
        String plain = limitSummary(cleanSummary(second.text()));
        if (plain != null && !plain.startsWith("{") && grounded(plain, comments)) {
            return Optional.of(new ReviewSummaryDraft(plain, List.of()));
        }
        log.warn("Review summary still ignored the supplied comments");
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
            return new ModelCall(extractText(body), false);
        } catch (RestClientResponseException ex) {
            log.warn("Gemini review summary failed: status {}", ex.getStatusCode().value());
            return new ModelCall(null, true);
        } catch (RestClientException ex) {
            log.warn("Gemini review summary failed: {}", ex.getClass().getSimpleName());
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
                "maxOutputTokens", 2048,
                "thinkingConfig", Map.of("thinkingLevel", "low")
            )
        );
    }

    private static String userPrompt(List<ReviewCommentSample> comments) {
        StringBuilder body = new StringBuilder("Reviews:\n");
        int index = 1;
        for (ReviewCommentSample comment : comments) {
            body.append(index++)
                .append(". Rating ")
                .append(comment.rating())
                .append("/5: ")
                .append(comment.comment())
                .append('\n');
        }
        return body.toString();
    }

    private static String retryPrompt(List<ReviewCommentSample> comments) {
        return """
            The previous answer was rejected because it was not JSON grounded in these reviews.
            Return only {"summary":"...","keywords":["..."]}.
            The summary must mention a concrete detail from the reviews. Keep their language.
            %s
            """.formatted(userPrompt(comments));
    }

    private Optional<ReviewSummaryDraft> parseDraft(String raw, List<ReviewCommentSample> comments) {
        String json = jsonObject(raw);
        if (json == null) {
            return Optional.empty();
        }
        try {
            JsonNode node = objectMapper.readTree(json);
            String summary = limitSummary(cleanSummary(node.path("summary").asText(null)));
            if (summary == null || !grounded(summary, comments)) {
                return Optional.empty();
            }
            return Optional.of(new ReviewSummaryDraft(summary, keywords(node.path("keywords"))));
        } catch (JsonProcessingException ex) {
            log.warn("Gemini review summary was not valid JSON");
            return Optional.empty();
        }
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

    static String jsonObject(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String cleaned = raw.strip();
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "").strip();
        }
        int start = cleaned.indexOf('{');
        int end = cleaned.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        return cleaned.substring(start, end + 1);
    }

    static boolean grounded(String summary, List<ReviewCommentSample> comments) {
        if (summary == null || summary.isBlank() || comments == null || comments.isEmpty()) {
            return false;
        }
        StringBuilder source = new StringBuilder();
        for (ReviewCommentSample comment : comments) {
            source.append(comment.comment() == null ? "" : comment.comment()).append(' ');
        }
        List<String> terms = significantTerms(source.toString());
        if (terms.isEmpty()) {
            return true;
        }
        String haystack = normalizeForMatch(summary);
        for (String term : terms) {
            if (haystack.contains(term)) {
                return true;
            }
        }
        return false;
    }

    static List<String> significantTerms(String text) {
        List<String> words = tokens(text);
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

    private List<String> keywords(JsonNode array) {
        if (array == null || !array.isArray()) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        for (JsonNode item : array) {
            String value = item.asText("").strip();
            if (value.isEmpty() || value.length() > MAX_KEYWORD_LENGTH) {
                continue;
            }
            String key = normalizeForMatch(value);
            boolean duplicate = result.stream().anyMatch(existing -> normalizeForMatch(existing).equals(key));
            if (duplicate) {
                continue;
            }
            result.add(value);
            if (result.size() == MAX_KEYWORDS) {
                break;
            }
        }
        return List.copyOf(result);
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
        cleaned = cleaned.replaceFirst("^(?i)(ai summary|summary|tóm tắt ai|tóm tắt)\\s*:\\s*", "").strip();
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
        if (lastSentence >= 200) {
            return cut.substring(0, lastSentence + 1).strip();
        }
        return cut.strip();
    }
}
