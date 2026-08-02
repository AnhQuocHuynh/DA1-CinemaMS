package com.uit.cinema.recommendation.graph;

import com.uit.cinema.recommendation.dto.MovieRecommendation;

import java.util.List;

public interface RecommendationGraphStore {

    boolean isAvailable();

    List<MovieRecommendation> findForUser(long userId, int limit);

    List<MovieRecommendation> findPopular(int limit);

    List<MovieRecommendation> findSimilar(long movieId, int limit);

    UserTasteProfile findTasteProfile(long userId);
}
