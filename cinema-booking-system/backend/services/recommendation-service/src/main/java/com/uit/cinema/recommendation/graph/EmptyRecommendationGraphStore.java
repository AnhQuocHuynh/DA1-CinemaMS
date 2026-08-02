package com.uit.cinema.recommendation.graph;

import com.uit.cinema.recommendation.dto.MovieRecommendation;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConditionalOnProperty(
    name = "recommendation.graph.enabled",
    havingValue = "false",
    matchIfMissing = true
)
public class EmptyRecommendationGraphStore implements RecommendationGraphStore {

    @Override
    public boolean isAvailable() {
        return false;
    }

    @Override
    public List<MovieRecommendation> findForUser(long userId, int limit) {
        return List.of();
    }

    @Override
    public List<MovieRecommendation> findPopular(int limit) {
        return List.of();
    }

    @Override
    public List<MovieRecommendation> findSimilar(long movieId, int limit) {
        return List.of();
    }

    @Override
    public UserTasteProfile findTasteProfile(long userId) {
        return UserTasteProfile.empty();
    }
}
