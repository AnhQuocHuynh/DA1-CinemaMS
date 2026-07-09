package com.uit.cinema.recommendation.service;

import com.uit.cinema.recommendation.dto.RecommendationMetadata;
import com.uit.cinema.recommendation.dto.RecommendationResponse;
import com.uit.cinema.recommendation.dto.TasteProfileResponse;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DefaultRecommendationService implements RecommendationService {

    @Override
    public RecommendationResponse recommendForUser(Long userId, int limit) {
        return emptyResponse(userId, "POPULARITY_FALLBACK");
    }

    @Override
    public RecommendationResponse popularMovies(int limit) {
        return emptyResponse(null, "POPULARITY");
    }

    @Override
    public RecommendationResponse similarMovies(Long movieId, int limit) {
        return emptyResponse(null, "CONTENT_SIMILARITY");
    }

    @Override
    public TasteProfileResponse tasteProfile(Long userId) {
        return new TasteProfileResponse(userId, List.of(), 0, true);
    }

    private RecommendationResponse emptyResponse(Long userId, String algorithm) {
        return new RecommendationResponse(
            userId,
            algorithm,
            List.of(),
            new RecommendationMetadata(0, 0, true)
        );
    }
}
