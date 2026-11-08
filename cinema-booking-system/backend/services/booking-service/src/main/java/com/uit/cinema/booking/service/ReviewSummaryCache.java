package com.uit.cinema.booking.service;

import com.uit.cinema.booking.entity.ReviewAiSummary;

import java.util.Optional;

public interface ReviewSummaryCache {

    Optional<ReviewAiSummary> find(String targetKey);

    void save(ReviewAiSummary row);
}
