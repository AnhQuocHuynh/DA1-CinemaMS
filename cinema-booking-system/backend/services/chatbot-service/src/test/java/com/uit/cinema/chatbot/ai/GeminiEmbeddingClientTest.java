package com.uit.cinema.chatbot.ai;

import com.uit.cinema.chatbot.config.CinemaAiProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class GeminiEmbeddingClientTest {

    private CinemaAiProperties properties;
    private MockRestServiceServer server;
    private GeminiEmbeddingClient client;

    @BeforeEach
    void setUp() {
        properties = new CinemaAiProperties();
        properties.setEnabled(true);
        properties.setApiKey("test-key");
        properties.setBaseUrl("https://generativelanguage.googleapis.com/v1beta");
        properties.setEmbeddingModel("gemini-embedding-001");
        RestClient.Builder builder = RestClient.builder().baseUrl(properties.getBaseUrl());
        server = MockRestServiceServer.bindTo(builder).build();
        client = new GeminiEmbeddingClient(builder.build(), properties);
    }

    @Test
    void requests768DimensionsAndReadsValues() {
        float[] expected = new float[EmbeddingDimensions.LENGTH];
        Arrays.fill(expected, 0.25f);
        String values = "[" + "0.25,".repeat(EmbeddingDimensions.LENGTH - 1) + "0.25]";
        server.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents"))
            .andExpect(header("x-goog-api-key", "test-key"))
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andRespond(withSuccess("{\"embeddings\":[{\"values\":" + values + "}]}", MediaType.APPLICATION_JSON));

        float[] actual = client.embed("ping");

        assertEquals(EmbeddingDimensions.LENGTH, actual.length);
        assertEquals(0.25f, actual[0], 0.0001);
        server.verify();
    }
}
