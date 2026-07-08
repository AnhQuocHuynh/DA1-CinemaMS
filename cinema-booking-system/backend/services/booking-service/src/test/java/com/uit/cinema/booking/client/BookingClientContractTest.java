package com.uit.cinema.booking.client;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class BookingClientContractTest {

    private static final Path CATALOG_CONTRACT =
        Path.of("../../shared/contracts/catalog-service.openapi.yml");
    private static final Path FACILITY_CONTRACT =
        Path.of("../../shared/contracts/facility-service.openapi.yml");
    private static final Path SHOWTIME_CONTRACT =
        Path.of("../../shared/contracts/showtime-service.openapi.yml");

    @Test
    void catalogContractExposesInternalProjectionEndpointsUsedByBooking() throws IOException {
        String contract = Files.readString(CATALOG_CONTRACT);

        assertContains(contract, "/internal/catalog/movies/{movieId}:");
        assertContains(contract, "/internal/catalog/events/{eventId}:");
        assertContains(contract, "name: X-Internal-Token");
    }

    @Test
    void facilityContractExposesInternalProjectionEndpointsUsedByBooking() throws IOException {
        String contract = Files.readString(FACILITY_CONTRACT);

        assertContains(contract, "/internal/facility/rooms/{roomId}:");
        assertContains(contract, "/internal/facility/seat-templates/{seatTemplateId}:");
        assertContains(contract, "name: X-Internal-Token");
    }

    @Test
    void showtimeContractExposesSeatReservationEndpointsUsedByBooking() throws IOException {
        String contract = Files.readString(SHOWTIME_CONTRACT);

        assertContains(contract, "/internal/showtimes/{showtimeId}/schedule:");
        assertContains(contract, "/internal/showtimes/seats/{seatId}:");
        assertContains(contract, "/internal/showtimes/seats/validate-held:");
        assertContains(contract, "/internal/showtimes/seats/validate-available:");
        assertContains(contract, "/internal/showtimes/seats/confirm-held:");
        assertContains(contract, "/internal/showtimes/seats/book-available:");
        assertContains(contract, "/internal/showtimes/seats/release-held:");
        assertContains(contract, "/internal/showtimes/seats/release-booked:");
        assertContains(contract, "SeatBookingRequest:");
        assertContains(contract, "SeatReleaseRequest:");
        assertContains(contract, "name: X-Internal-Token");
    }

    private void assertContains(String contract, String expected) {
        assertTrue(contract.contains(expected), () -> "Missing contract fragment: " + expected);
    }
}
