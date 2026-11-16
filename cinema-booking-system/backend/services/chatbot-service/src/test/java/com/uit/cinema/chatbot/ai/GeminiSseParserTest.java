package com.uit.cinema.chatbot.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GeminiSseParserTest {

    @Test
    void readsTextPartsFromSseFrames() throws Exception {
        String body = """
            data: {"candidates":[{"content":{"parts":[{"thought":true,"text":"nháp"},{"text":"Xin "}]}}]}

            data: {"candidates":[{"content":{"parts":[{"text":"chào"}]}}]}

            data: [DONE]
            """;
        List<String> tokens = GeminiSseParser.readTokens(body, new ObjectMapper());
        assertEquals(List.of("Xin ", "chào"), tokens);
    }
}
