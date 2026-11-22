package com.uit.cinema.recommendation.service;

import com.uit.cinema.recommendation.client.CatalogFeatureClient;
import com.uit.cinema.recommendation.dto.MovieRecommendationResponse;
import com.uit.cinema.recommendation.dto.RatingPredictionResponse;
import com.uit.cinema.recommendation.persistence.SystemConfig;
import com.uit.cinema.recommendation.persistence.SystemConfigRepository;
import com.uit.cinema.recommendation.persistence.UserRating;
import com.uit.cinema.recommendation.persistence.UserRatingRepository;
import com.uit.cinema.recommendation.uncertainty.AlgorithmConfigKeys;
import com.uit.cinema.recommendation.uncertainty.MovieDissimilarityCalculator;
import com.uit.cinema.recommendation.uncertainty.MovieFeature;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MovieRecommendationService {

    static final int DEFAULT_CANDIDATE_LIMIT = 1000;
    private static final double DEFAULT_MAX_DISSIM = 1000.0;
    private static final double DEFAULT_UNCERTAINTY_THRESHOLD = 12.0;
    private static final double DEFAULT_USER_MEAN = 3.0;
    private static final String SHOWING = "SHOWING";

    private final CatalogFeatureClient catalogFeatureClient;
    private final UserRatingRepository userRatingRepository;
    private final SystemConfigRepository systemConfigRepository;
    private final MovieDissimilarityCalculator dissimilarityCalculator;
    private final UserRatingService userRatingService;

    public RatingPredictionResponse predictRating(Long userId, Long targetMovieId) {
        requireUser(userId);
        MovieFeature target = catalogFeatureClient.requireFeature(targetMovieId);
        List<MovieFeature> catalog = catalogFeatureClient.loadAll();
        UserRatingProfile profile = loadProfile(userId, index(catalog));
        return predict(userId, target, profile, loadParameters());
    }

    public List<MovieRecommendationResponse> recommendTopKMovies(Long userId, int k) {
        requireUser(userId);
        if (k <= 0) {
            return List.of();
        }
        int safeK = Math.min(k, 100);
        List<MovieFeature> catalog = catalogFeatureClient.loadAll();
        Map<Long, MovieFeature> byId = index(catalog);
        UserRatingProfile profile = loadProfile(userId, byId);
        if (profile.ratings().isEmpty()) {
            return coldStart(catalog, safeK);
        }

        AlgorithmParameters parameters = loadParameters();
        return catalog.stream()
                .filter(movie -> SHOWING.equals(movie.status()))
                .filter(movie -> !profile.seenMovieIds().contains(movie.id()))
                .sorted(Comparator.comparing(MovieFeature::imdbRating, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(DEFAULT_CANDIDATE_LIMIT)
                .map(movie -> toRecommendation(movie, predict(userId, movie, profile, parameters), byId, profile))
                .sorted(Comparator
                        .comparing(MovieRecommendationResponse::predictedRating).reversed()
                        .thenComparing(MovieRecommendationResponse::uncertaintyScore))
                .limit(safeK)
                .toList();
    }

    private List<MovieRecommendationResponse> coldStart(List<MovieFeature> catalog, int k) {
        return catalog.stream()
                .filter(movie -> SHOWING.equals(movie.status()))
                .sorted(Comparator.comparing(MovieFeature::imdbRating, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(k)
                .map(movie -> new MovieRecommendationResponse(
                        movie.id(),
                        movie.title(),
                        movie.posterUrl(),
                        mapImdbToFiveStars(movie.imdbRating()),
                        100.0,
                        null,
                        null,
                        null))
                .toList();
    }

    private RatingPredictionResponse predict(Long userId, MovieFeature target, UserRatingProfile profile, AlgorithmParameters parameters) {
        if (profile.ratings().isEmpty()) {
            double fallback = mapImdbToFiveStars(target.imdbRating());
            return new RatingPredictionResponse(
                    userId, target.id(), null, fallback, fallback, DEFAULT_USER_MEAN,
                    parameters.maxDissimilarity(), 100.0, false);
        }

        RatedMovie nearest = null;
        double minDissimilarity = Double.MAX_VALUE;
        for (RatedMovie rated : profile.ratings()) {
            if (rated.feature() == null) {
                continue;
            }
            double dissimilarity = dissimilarityCalculator.calculateTotalDissimilarity(target, rated.feature());
            if (dissimilarity < minDissimilarity) {
                minDissimilarity = dissimilarity;
                nearest = rated;
            }
        }
        if (nearest == null) {
            double fallback = mapImdbToFiveStars(target.imdbRating());
            return new RatingPredictionResponse(
                    userId, target.id(), null, fallback, fallback, profile.userMeanRating(),
                    parameters.maxDissimilarity(), 100.0, false);
        }

        double rawPrediction = clamp(nearest.ratingValue());
        double uncertaintyScore = computeUncertainty(minDissimilarity, parameters.maxDissimilarity());
        boolean thresholdApplied = uncertaintyScore > parameters.uncertaintyThreshold();
        double finalPrediction = rawPrediction;
        if (thresholdApplied) {
            finalPrediction = rawPrediction - (rawPrediction - profile.userMeanRating()) * (uncertaintyScore / 100.0);
        }
        return new RatingPredictionResponse(
                userId,
                target.id(),
                nearest.feature().id(),
                rawPrediction,
                clamp(finalPrediction),
                profile.userMeanRating(),
                minDissimilarity,
                uncertaintyScore,
                thresholdApplied);
    }

    private UserRatingProfile loadProfile(Long userId, Map<Long, MovieFeature> liveFeatures) {
        List<UserRating> stored = userRatingRepository.findByUserIdOrderByCreatedAtDesc(userId);
        Set<Long> seen = new HashSet<>();
        List<RatedMovie> ratings = new ArrayList<>();
        for (UserRating storedRating : stored) {
            if (!seen.add(storedRating.getMovieId())) {
                continue;
            }
            MovieFeature feature = liveFeatures.get(storedRating.getMovieId());
            if (feature == null) {
                feature = userRatingService.snapshotOf(storedRating);
            }
            ratings.add(new RatedMovie(feature, storedRating.getRatingValue()));
        }
        return new UserRatingProfile(ratings, seen, userRatingService.averageRating(userId));
    }

    private AlgorithmParameters loadParameters() {
        double maxDissimilarity = readConfig(AlgorithmConfigKeys.MAX_MOVIE_DISSIMILARITY, DEFAULT_MAX_DISSIM);
        if (maxDissimilarity <= 0.0) {
            maxDissimilarity = DEFAULT_MAX_DISSIM;
        }
        double threshold = readConfig(AlgorithmConfigKeys.UNCERTAINTY_THRESHOLD, DEFAULT_UNCERTAINTY_THRESHOLD);
        return new AlgorithmParameters(maxDissimilarity, threshold);
    }

    private double readConfig(String key, double defaultValue) {
        return systemConfigRepository.findById(key)
                .map(SystemConfig::getConfigValue)
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(value -> {
                    try {
                        return Double.parseDouble(value);
                    } catch (NumberFormatException exception) {
                        return defaultValue;
                    }
                })
                .orElse(defaultValue);
    }

    private double computeUncertainty(double minDissimilarity, double maxDissimilarity) {
        if (maxDissimilarity <= 0.0) {
            return 100.0;
        }
        double uncertainty = (minDissimilarity / maxDissimilarity) * 100.0;
        return Math.max(0.0, Math.min(100.0, uncertainty));
    }

    private double mapImdbToFiveStars(Double imdbRating) {
        if (imdbRating == null || imdbRating <= 0.0) {
            return DEFAULT_USER_MEAN;
        }
        return clamp(imdbRating / 2.0);
    }

    private double clamp(double ratingValue) {
        return Math.max(1.0, Math.min(5.0, ratingValue));
    }

    private Map<Long, MovieFeature> index(List<MovieFeature> features) {
        Map<Long, MovieFeature> byId = new HashMap<>();
        for (MovieFeature feature : features) {
            if (feature.id() != null) {
                byId.put(feature.id(), feature);
            }
        }
        return byId;
    }

    private void requireUser(Long userId) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED");
        }
    }

    private MovieRecommendationResponse toRecommendation(MovieFeature movie, RatingPredictionResponse prediction, Map<Long, MovieFeature> byId, UserRatingProfile profile) {
        Long nearestId = prediction.nearestMovieId();
        MovieFeature nearest = nearestId == null ? null : byId.get(nearestId);
        if (nearest == null && nearestId != null) {
            nearest = profile.ratings().stream()
                    .map(RatedMovie::feature)
                    .filter(feature -> nearestId.equals(feature.id()))
                    .findFirst()
                    .orElse(null);
        }
        return new MovieRecommendationResponse(
                movie.id(),
                movie.title(),
                movie.posterUrl(),
                prediction.finalPrediction(),
                prediction.uncertaintyScore(),
                nearestId,
                nearest == null ? null : nearest.title(),
                nearest == null ? null : nearest.posterUrl());
    }

    private record RatedMovie(MovieFeature feature, Double ratingValue) {
    }

    private record UserRatingProfile(List<RatedMovie> ratings, Set<Long> seenMovieIds, double userMeanRating) {
    }

    private record AlgorithmParameters(double maxDissimilarity, double uncertaintyThreshold) {
    }
}
