package com.uit.cinema.chatbot.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

public final class GeminiSseParser {

    private GeminiSseParser() {
    }

    public static List<String> readTokens(String body, ObjectMapper mapper) throws IOException {
        List<String> tokens = new ArrayList<>();
        readTokens(new BufferedReader(new StringReader(body == null ? "" : body)), mapper, tokens::add);
        return tokens;
    }

    public static void readTokens(BufferedReader reader, ObjectMapper mapper, Consumer<String> tokens) throws IOException {
        String line;
        while ((line = reader.readLine()) != null) {
            String trimmed = line.trim();
            if (!trimmed.startsWith("data:")) {
                continue;
            }
            String payload = trimmed.substring("data:".length()).trim();
            if (payload.isEmpty() || "[DONE]".equals(payload)) {
                continue;
            }
            String text = textFromChunk(mapper.readTree(payload));
            if (!text.isEmpty()) {
                tokens.accept(text);
            }
        }
    }

    public static String textFromChunk(JsonNode root) {
        if (root == null) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        JsonNode parts = root.path("candidates").path(0).path("content").path("parts");
        if (parts.isArray()) {
            for (JsonNode part : parts) {
                if (part.path("thought").asBoolean(false)) {
                    continue;
                }
                String text = part.path("text").asText("");
                builder.append(text);
            }
        }
        return builder.toString();
    }
}
