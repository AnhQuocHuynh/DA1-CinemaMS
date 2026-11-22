package com.uit.cinema.booking.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uit.cinema.booking.config.CinemaAiProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class GeminiReviewSummaryClientTest {

    private static final List<ReviewCommentSample> COMMENTS = List.of(
        new ReviewCommentSample(1, 2, "Ghế cứng và âm thanh nhỏ.")
    );

    private final ObjectMapper objectMapper = new ObjectMapper();
    private CinemaAiProperties properties;
    private MockRestServiceServer server;
    private GeminiReviewSummaryClient client;

    @BeforeEach
    void setUp() {
        properties = new CinemaAiProperties();
        properties.setEnabled(true);
        properties.setApiKey("test-key");
        properties.setModel("gemini-3.5-flash");
        properties.setBaseUrl("https://generativelanguage.googleapis.com/v1beta");
        properties.setTimeout(Duration.ofSeconds(5));

        RestClient.Builder builder = RestClient.builder().baseUrl(properties.getBaseUrl());
        server = MockRestServiceServer.bindTo(builder).build();
        client = new GeminiReviewSummaryClient(builder.build(), properties);
    }

    @Test
    void parsesJsonAndSkipsThoughts() throws Exception {
        String payload = """
            {"summary":"Nhiều người phàn nàn ghế cứng và âm thanh nhỏ.","keywords":["ghế cứng","âm thanh","ghế cứng"]}
            """;
        server.expect(requestTo(containsString("/models/gemini-3.5-flash:generateContent")))
            .andExpect(header("x-goog-api-key", "test-key"))
            .andExpect(content().string(containsString("Ghế cứng")))
            .andExpect(content().string(not(containsString("test-key"))))
            .andRespond(withSuccess(geminiTextWithThought(payload), MediaType.APPLICATION_JSON));

        Optional<ReviewSummaryDraft> result = client.summarize(COMMENTS);

        assertEquals("Nhiều người phàn nàn ghế cứng và âm thanh nhỏ.", result.orElseThrow().summary());
        assertEquals(List.of("ghế cứng", "âm thanh"), result.orElseThrow().keywords());
        server.verify();
    }

    @Test
    void stripsMarkdownFence() throws Exception {
        String payload = """
            ```json
            {"summary":"Khán giả chê âm thanh nhỏ.","keywords":["âm thanh"]}
            ```
            """;
        server.expect(requestTo(containsString(":generateContent")))
            .andRespond(withSuccess(geminiText(payload), MediaType.APPLICATION_JSON));

        Optional<ReviewSummaryDraft> result = client.summarize(COMMENTS);

        assertEquals("Khán giả chê âm thanh nhỏ.", result.orElseThrow().summary());
        assertEquals(List.of("âm thanh"), result.orElseThrow().keywords());
        server.verify();
    }

    @Test
    void retriesWhenSummaryIgnoresTheComments() throws Exception {
        server.expect(requestTo(containsString(":generateContent")))
            .andRespond(withSuccess(geminiText(jsonSummary(
                "Khán giả có trải nghiệm tuyệt vời tại rạp chiếu.",
                List.of("tuyệt vời")
            )), MediaType.APPLICATION_JSON));
        server.expect(requestTo(containsString(":generateContent")))
            .andExpect(content().string(containsString("rejected")))
            .andRespond(withSuccess(geminiText(jsonSummary(
                "Nhiều người phàn nàn ghế cứng và âm thanh nhỏ.",
                List.of("âm thanh")
            )), MediaType.APPLICATION_JSON));

        Optional<ReviewSummaryDraft> result = client.summarize(COMMENTS);

        assertEquals("Nhiều người phàn nàn ghế cứng và âm thanh nhỏ.", result.orElseThrow().summary());
        server.verify();
    }

    @Test
    void returnsEmptyWhenBothSummariesIgnoreTheComments() throws Exception {
        String generic = jsonSummary("Khán giả có trải nghiệm tuyệt vời tại rạp chiếu.", List.of("tuyệt vời"));
        server.expect(requestTo(containsString(":generateContent")))
            .andRespond(withSuccess(geminiText(generic), MediaType.APPLICATION_JSON));
        server.expect(requestTo(containsString(":generateContent")))
            .andRespond(withSuccess(geminiText(generic), MediaType.APPLICATION_JSON));

        assertEquals(Optional.empty(), client.summarize(COMMENTS));
        server.verify();
    }

    @Test
    void http429ReturnsEmpty() {
        server.expect(requestTo(containsString(":generateContent")))
            .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));

        assertEquals(Optional.empty(), client.summarize(COMMENTS));
        server.verify();
    }

    @Test
    void blankKeyDoesNotCallApi() {
        properties.setApiKey("  ");

        assertEquals(Optional.empty(), client.summarize(COMMENTS));
        server.verify();
    }

    @Test
    void disabledDoesNotCallApi() {
        properties.setEnabled(false);

        assertEquals(Optional.empty(), client.summarize(COMMENTS));
        server.verify();
    }

    @Test
    void groundedAcceptsACommentDetailAndRejectsGenericFiller() {
        assertTrue(GeminiReviewSummaryClient.grounded("Nhiều người chê âm thanh nhỏ.", COMMENTS));
        assertFalse(GeminiReviewSummaryClient.grounded("Khán giả có trải nghiệm tuyệt vời tại rạp chiếu.", COMMENTS));
    }

    private String geminiText(String text) throws Exception {
        return "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":" + objectMapper.writeValueAsString(text) + "}]}}]}";
    }

    private String geminiTextWithThought(String text) throws Exception {
        return """
            {"candidates":[{"content":{"parts":[
              {"thought":true,"text":"draft"},
              {"text":%s}
            ]}}]}
            """.formatted(objectMapper.writeValueAsString(text));
    }

    private String jsonSummary(String summary, List<String> keywords) throws Exception {
        return objectMapper.writeValueAsString(new ReviewSummaryDraft(summary, keywords));
    }
}
