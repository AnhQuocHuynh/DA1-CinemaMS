package com.uit.cinema.recommendation.dto;

import java.util.List;

public record RecommendationResponse(
    Long userId,
    String algorithm,
    List<MovieRecommendation> recommendations,
    RecommendationMetadata metadata
) {
}
