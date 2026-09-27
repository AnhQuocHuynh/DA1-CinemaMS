package com.uit.cinema.recommendation.controller;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class RecommendationOpenApiContractTest {

    private static final Path RECOMMENDATION_CONTRACT =
        Path.of("../../shared/contracts/recommendation-service.openapi.yml");

    @Test
    void contractExposesRecommendationRoutes() throws IOException {
        String contract = Files.readString(RECOMMENDATION_CONTRACT);

        assertContains(contract, "/api/recommendations/movies:");
        assertContains(contract, "/api/recommendations/movies/popular:");
        assertContains(contract, "/api/recommendations/movies/{movieId}/similar:");
        assertContains(contract, "/api/recommendations/users/{userId}/taste-profile:");
    }

    private void assertContains(String contract, String expected) {
        assertTrue(contract.contains(expected), () -> "Missing contract fragment: " + expected);
    }
}
