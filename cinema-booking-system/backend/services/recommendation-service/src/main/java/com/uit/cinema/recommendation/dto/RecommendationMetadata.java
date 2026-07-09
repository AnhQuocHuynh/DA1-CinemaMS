package com.uit.cinema.recommendation.dto;

public record RecommendationMetadata(
    int totalCandidates,
    long processingTimeMs,
    boolean fallbackUsed
) {
}
