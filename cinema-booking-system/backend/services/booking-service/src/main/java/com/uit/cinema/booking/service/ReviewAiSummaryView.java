package com.uit.cinema.booking.service;

import java.util.List;

public record ReviewAiSummaryView(String summary, List<String> keywords) {

    public ReviewAiSummaryView {
        keywords = keywords == null ? List.of() : List.copyOf(keywords);
    }

    public static ReviewAiSummaryView empty() {
        return new ReviewAiSummaryView(null, List.of());
    }
}
