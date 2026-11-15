package com.uit.cinema.recommendation.dto;

import java.util.List;

public record UserRatingPageResponse(
        List<UserRatingResponse> items,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}
