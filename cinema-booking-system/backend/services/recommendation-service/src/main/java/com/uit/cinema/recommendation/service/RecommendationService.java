package com.uit.cinema.recommendation.service;

import com.uit.cinema.recommendation.dto.RecommendationResponse;
import com.uit.cinema.recommendation.dto.TasteProfileResponse;

public interface RecommendationService {
    RecommendationResponse recommendForUser(Long userId, int limit);

    RecommendationResponse popularMovies(int limit);

    RecommendationResponse similarMovies(Long movieId, int limit);

    TasteProfileResponse tasteProfile(Long userId);
}
