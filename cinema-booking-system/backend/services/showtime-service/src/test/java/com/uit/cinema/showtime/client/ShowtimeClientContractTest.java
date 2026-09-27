package com.uit.cinema.showtime.client;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ShowtimeClientContractTest {

    private static final Path CATALOG_CONTRACT =
        Path.of("../../shared/contracts/catalog-service.openapi.yml");
    private static final Path FACILITY_CONTRACT =
        Path.of("../../shared/contracts/facility-service.openapi.yml");

    @Test
    void catalogContractExposesInternalProjectionEndpointsUsedByShowtime() throws IOException {
        String contract = Files.readString(CATALOG_CONTRACT);

        assertContains(contract, "/internal/catalog/movies/{movieId}:");
        assertContains(contract, "/internal/catalog/events/{eventId}:");
        assertContains(contract, "internalToken:");
        assertContains(contract, "name: X-Internal-Token");
    }

    @Test
    void facilityContractExposesInternalProjectionEndpointsUsedByShowtime() throws IOException {
        String contract = Files.readString(FACILITY_CONTRACT);

        assertContains(contract, "/internal/facility/rooms/{roomId}:");
        assertContains(contract, "/internal/facility/seat-templates/{seatTemplateId}:");
        assertContains(contract, "/internal/facility/rooms/{roomId}/seat-templates:");
        assertContains(contract, "internalToken:");
        assertContains(contract, "name: X-Internal-Token");
    }

    private void assertContains(String contract, String expected) {
        assertTrue(contract.contains(expected), () -> "Missing contract fragment: " + expected);
    }
}
