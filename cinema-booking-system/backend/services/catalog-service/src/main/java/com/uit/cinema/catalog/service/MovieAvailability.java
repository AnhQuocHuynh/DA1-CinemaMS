package com.uit.cinema.catalog.service;

import com.uit.cinema.core.exception.CustomException;
import org.springframework.http.HttpStatus;

import java.time.LocalDate;

public final class MovieAvailability {

    public static final String SHOWING = "SHOWING";
    public static final String UPCOMING = "UPCOMING";
    public static final String INACTIVE = "INACTIVE";

    private MovieAvailability() {
    }

    public static String statusOf(boolean active, LocalDate releaseDate, LocalDate today) {
        if (!active) {
            return INACTIVE;
        }
        if (releaseDate != null && releaseDate.isAfter(today)) {
            return UPCOMING;
        }
        return SHOWING;
    }

    public static String normalizeFilter(String status) {
        if (status == null || status.isBlank() || "ALL".equalsIgnoreCase(status.trim())) {
            return null;
        }
        String normalized = status.trim().toUpperCase();
        if (!SHOWING.equals(normalized) && !UPCOMING.equals(normalized)) {
            throw new CustomException(
                    "status must be SHOWING or UPCOMING",
                    HttpStatus.BAD_REQUEST,
                    "INVALID_MOVIE_STATUS");
        }
        return normalized;
    }
}
