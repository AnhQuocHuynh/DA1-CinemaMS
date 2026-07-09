package com.uit.cinema.recommendation.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class RecommendationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void popularMoviesReturnsFallbackEnvelope() throws Exception {
        mockMvc.perform(get("/api/recommendations/movies/popular"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.algorithm").value("POPULARITY"))
            .andExpect(jsonPath("$.data.recommendations", hasSize(0)))
            .andExpect(jsonPath("$.data.metadata.fallbackUsed").value(true));
    }

    @Test
    void tasteProfileReturnsFallbackEnvelope() throws Exception {
        mockMvc.perform(get("/api/recommendations/users/42/taste-profile"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.userId").value(42))
            .andExpect(jsonPath("$.data.preferredGenres", hasSize(0)))
            .andExpect(jsonPath("$.data.fallbackUsed").value(true));
    }
}
