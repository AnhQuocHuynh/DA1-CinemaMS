package com.uit.cinema.catalog.service;

import com.uit.cinema.catalog.config.CinemaAiProperties;
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
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class GeminiMovieSummaryClientTest {

    private CinemaAiProperties properties;
    private MockRestServiceServer server;
    private GeminiMovieSummaryClient client;

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
        client = new GeminiMovieSummaryClient(builder.build(), properties);
    }

    @Test
    void parsesOutputAndSkipsThoughts() {
        server.expect(requestTo(containsString("/models/gemini-3.5-flash:generateContent")))
            .andExpect(header("x-goog-api-key", "test-key"))
            .andExpect(content().string(containsString("A thief enters dreams.")))
            .andExpect(content().string(containsString("same language")))
            .andExpect(content().string(containsString("thinkingLevel")))
            .andRespond(withSuccess("""
                {
                  "candidates": [{
                    "content": {
                      "parts": [
                        {"text": "hidden reasoning", "thought": true},
                        {"text": "Inception follows a thief into layered dreams."}
                      ]
                    }
                  }]
                }
                """, MediaType.APPLICATION_JSON));

        Optional<String> result = client.summarize("Inception", "A thief enters dreams.", List.of("Sci-Fi"));

        assertEquals(Optional.of("Inception follows a thief into layered dreams."), result);
        server.verify();
    }

    @Test
    void retriesWhenSummaryIgnoresTheFilm() {
        String generic = "Set against an expansive cinematic canvas, this compelling story chronicles an extraordinary journey.";
        server.expect(requestTo(containsString(":generateContent")))
            .andRespond(withSuccess(geminiText(generic), MediaType.APPLICATION_JSON));
        server.expect(requestTo(containsString(":generateContent")))
            .andExpect(content().string(containsString("rejected")))
            .andExpect(content().string(containsString("Doraemon")))
            .andRespond(withSuccess(
                geminiText("Doraemon cùng Nobita khám phá lâu đài dưới đáy biển."),
                MediaType.APPLICATION_JSON
            ));

        Optional<String> result = client.summarize(
            "Doraemon Lâu đài dưới đáy biển",
            "Doraemon movie 45: Tân - Lâu đài dưới đáy biển",
            List.of("Animation")
        );

        assertEquals(Optional.of("Doraemon cùng Nobita khám phá lâu đài dưới đáy biển."), result);
        server.verify();
    }

    @Test
    void returnsEmptyWhenBothSummariesIgnoreTheFilm() {
        String generic = "This compelling story chronicles an extraordinary journey and the resilient human spirit.";
        server.expect(requestTo(containsString(":generateContent")))
            .andRespond(withSuccess(geminiText(generic), MediaType.APPLICATION_JSON));
        server.expect(requestTo(containsString(":generateContent")))
            .andRespond(withSuccess(geminiText(generic), MediaType.APPLICATION_JSON));

        Optional<String> result = client.summarize(
            "Doraemon Lâu đài dưới đáy biển",
            "Doraemon movie 45: Tân - Lâu đài dưới đáy biển",
            List.of()
        );

        assertEquals(Optional.empty(), result);
        server.verify();
    }

    @Test
    void mentionsSourceAcceptsTheFilmAndRejectsGenericFiller() {
        String title = "Doraemon Lâu đài dưới đáy biển";
        String description = "Doraemon movie 45: Tân - Lâu đài dưới đáy biển";
        String generic = "Set against an expansive cinematic canvas, this compelling story chronicles an extraordinary journey filled with tremendous stakes.";

        assertTrue(GeminiMovieSummaryClient.mentionsSource(
            "Doraemon cùng Nobita tìm lâu đài dưới đáy biển.",
            title,
            description
        ));
        assertFalse(GeminiMovieSummaryClient.mentionsSource(generic, title, description));
    }

    private static String geminiText(String text) {
        return """
            {
              "candidates": [{
                "content": {
                  "parts": [{ "text": "%s" }]
                }
              }]
            }
            """.formatted(text);
    }

    @Test
    void http429ReturnsEmpty() {
        server.expect(requestTo(containsString(":generateContent")))
            .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));

        Optional<String> result = client.summarize("Title", "Plot", List.of());

        assertEquals(Optional.empty(), result);
        server.verify();
    }

    @Test
    void http500ReturnsEmpty() {
        server.expect(requestTo(containsString(":generateContent")))
            .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

        Optional<String> result = client.summarize("Title", "Plot", List.of());

        assertEquals(Optional.empty(), result);
        server.verify();
    }

    @Test
    void blankKeyDoesNotCallApi() {
        properties.setApiKey("  ");

        Optional<String> result = client.summarize("Title", "Plot", List.of());

        assertEquals(Optional.empty(), result);
        server.verify();
    }

    @Test
    void disabledDoesNotCallApi() {
        properties.setEnabled(false);

        Optional<String> result = client.summarize("Title", "Plot", List.of());

        assertEquals(Optional.empty(), result);
        server.verify();
    }

    @Test
    void limitSummaryCutsAtSentenceBoundary() {
        String longText = "A".repeat(800) + ". " + "B".repeat(1500);
        String limited = GeminiMovieSummaryClient.limitSummary(longText);

        assertTrue(limited.endsWith("."));
        assertTrue(limited.length() <= GeminiMovieSummaryClient.MAX_SUMMARY_LENGTH);
    }

    @Test
    void cleanSummaryStripsPrefixesAndQuotes() {
        assertEquals("Nội dung tóm tắt phim.", GeminiMovieSummaryClient.cleanSummary("Tóm tắt AI: Nội dung tóm tắt phim."));
        assertEquals("Nội dung tóm tắt phim.", GeminiMovieSummaryClient.cleanSummary("Tóm tắt: Nội dung tóm tắt phim."));
        assertEquals("Nội dung tóm tắt phim.", GeminiMovieSummaryClient.cleanSummary("AI Summary: Nội dung tóm tắt phim."));
        assertEquals("Nội dung tóm tắt phim.", GeminiMovieSummaryClient.cleanSummary("\"Nội dung tóm tắt phim.\""));
    }
}
