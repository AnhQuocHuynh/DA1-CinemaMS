package com.uit.cinema.catalog.service.client;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class CatalogShowtimeContractTest {

    private static final Path SHOWTIME_CONTRACT =
        Path.of("../../shared/contracts/showtime-service.openapi.yml");

    @Test
    void showtimeContractExposesEventCommandEndpointsUsedByCatalog() throws IOException {
        String contract = Files.readString(SHOWTIME_CONTRACT);

        assertContains(contract, "/internal/showtimes/events:");
        assertContains(contract, "/internal/showtimes/events/{eventId}:");
        assertContains(contract, "internalToken:");
        assertContains(contract, "name: X-Internal-Token");
        assertContains(contract, "EventShowtimeCreateRequest:");
    }

    private void assertContains(String contract, String expected) {
        assertTrue(contract.contains(expected), () -> "Missing contract fragment: " + expected);
    }
}
