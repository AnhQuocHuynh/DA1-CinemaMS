package com.uit.cinema.recommendation.service;

import com.uit.cinema.recommendation.dto.RecommendationMetadata;
import com.uit.cinema.recommendation.dto.MovieRecommendation;
import com.uit.cinema.recommendation.dto.RecommendationResponse;
import com.uit.cinema.recommendation.dto.TasteProfileResponse;
import com.uit.cinema.recommendation.graph.RecommendationGraphStore;
import com.uit.cinema.recommendation.graph.UserTasteProfile;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
public class DefaultRecommendationService implements RecommendationService {

    private final RecommendationGraphStore graphStore;

    public DefaultRecommendationService(RecommendationGraphStore graphStore) {
        this.graphStore = graphStore;
    }

    @Override
    public RecommendationResponse recommendForUser(Long userId, int limit) {
        int safeLimit = safeLimit(limit);
        Instant startedAt = Instant.now();
        if (userId != null && graphStore.isAvailable()) {
            List<MovieRecommendation> personalized =
                graphStore.findForUser(userId, safeLimit);
            if (!personalized.isEmpty()) {
                return response(userId, "HYBRID_GRAPH", personalized, startedAt, false);
            }
        }
        List<MovieRecommendation> popular =
            graphStore.findPopular(safeLimit);
        return response(userId, "POPULARITY_FALLBACK", popular, startedAt, true);
    }

    @Override
    public RecommendationResponse popularMovies(int limit) {
        Instant startedAt = Instant.now();
        List<MovieRecommendation> recommendations =
            graphStore.findPopular(safeLimit(limit));
        return response(null, "POPULARITY", recommendations, startedAt, !graphStore.isAvailable());
    }

    @Override
    public RecommendationResponse similarMovies(Long movieId, int limit) {
        int safeLimit = safeLimit(limit);
        Instant startedAt = Instant.now();
        List<MovieRecommendation> similar = graphStore.isAvailable()
            ? graphStore.findSimilar(movieId, safeLimit)
            : List.of();
        if (!similar.isEmpty()) {
            return response(null, "CONTENT_SIMILARITY", similar, startedAt, false);
        }
        return response(
            null,
            "POPULARITY_FALLBACK",
            graphStore.findPopular(safeLimit),
            startedAt,
            true
        );
    }

    @Override
    public TasteProfileResponse tasteProfile(Long userId) {
        UserTasteProfile profile = graphStore.findTasteProfile(userId);
        return new TasteProfileResponse(
            userId,
            profile.preferredGenres(),
            profile.watchedMovies(),
            !graphStore.isAvailable() || profile.preferredGenres().isEmpty()
        );
    }

    private RecommendationResponse response(
        Long userId,
        String algorithm,
        List<MovieRecommendation> recommendations,
        Instant startedAt,
        boolean fallbackUsed
    ) {
        return new RecommendationResponse(
            userId,
            algorithm,
            recommendations,
            new RecommendationMetadata(
                recommendations.size(),
                Duration.between(startedAt, Instant.now()).toMillis(),
                fallbackUsed
            )
        );
    }

    private int safeLimit(int limit) {
        return Math.max(1, Math.min(limit, 100));
    }
}
