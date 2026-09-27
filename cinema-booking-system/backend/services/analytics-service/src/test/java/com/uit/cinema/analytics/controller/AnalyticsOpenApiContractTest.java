package com.uit.cinema.analytics.controller;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AnalyticsOpenApiContractTest {

    private static final Path ANALYTICS_CONTRACT =
        Path.of("../../shared/contracts/analytics-service.openapi.yml");

    @Test
    void contractExposesAdminDashboardRoutes() throws IOException {
        String contract = Files.readString(ANALYTICS_CONTRACT);

        assertContains(contract, "/api/admin/dashboard/overview:");
        assertContains(contract, "/api/admin/dashboard/revenue-series:");
        assertContains(contract, "/api/admin/dashboard/live-sales:");
        assertContains(contract, "/api/admin/dashboard/popular-movies:");
    }

    private void assertContains(String contract, String expected) {
        assertTrue(contract.contains(expected), () -> "Missing contract fragment: " + expected);
    }
}
