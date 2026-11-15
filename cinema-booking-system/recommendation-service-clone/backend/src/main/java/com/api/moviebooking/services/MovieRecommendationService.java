package com.api.moviebooking.services;

import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.api.moviebooking.helpers.constants.AlgorithmConfigKeys;
import com.api.moviebooking.helpers.exceptions.ResourceNotFoundException;
import com.api.moviebooking.models.dtos.recommendation.MovieRecommendationDTO;
import com.api.moviebooking.models.dtos.recommendation.RatingPredictionDTO;
import com.api.moviebooking.models.entities.Movie;
import com.api.moviebooking.models.entities.SystemConfig;
import com.api.moviebooking.models.entities.UserRating;
import com.api.moviebooking.models.enums.MovieStatus;
import com.api.moviebooking.repositories.MovieRepo;
import com.api.moviebooking.repositories.SystemConfigRepository;
import com.api.moviebooking.repositories.UserRatingRepository;
import com.api.moviebooking.repositories.UserRepo;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MovieRecommendationService {

    private static final int DEFAULT_CANDIDATE_LIMIT = 1000;
    private static final double DEFAULT_MAX_DISSIM = 1000.0;
    private static final double DEFAULT_UNCERTAINTY_THRESHOLD = 12.0;
    private static final double DEFAULT_USER_MEAN = 3.0;

    private final MovieRepo movieRepo;
    private final UserRepo userRepo;
    private final UserRatingRepository userRatingRepository;
    private final SystemConfigRepository systemConfigRepository;
    private final MovieDissimilarityCalculator dissimilarityCalculator;
    private final UserRatingService userRatingService;

    public double calculateNumericalDissimilarity(UUID movieIdA, UUID movieIdB) {
        Movie movieA = movieRepo.findById(movieIdA)
                .orElseThrow(() -> new ResourceNotFoundException("Movie", "id", movieIdA));
        Movie movieB = movieRepo.findById(movieIdB)
                .orElseThrow(() -> new ResourceNotFoundException("Movie", "id", movieIdB));

        return dissimilarityCalculator.calculateNumericalDissimilarity(movieA, movieB);
    }

    public double calculateCategoricalDissimilarity(UUID movieIdA, UUID movieIdB) {
        Movie movieA = movieRepo.findById(movieIdA)
                .orElseThrow(() -> new ResourceNotFoundException("Movie", "id", movieIdA));
        Movie movieB = movieRepo.findById(movieIdB)
                .orElseThrow(() -> new ResourceNotFoundException("Movie", "id", movieIdB));

        return dissimilarityCalculator.calculateCategoricalDissimilarity(movieA, movieB);
    }

    public RatingPredictionDTO predictRating(UUID userId, UUID targetMovieId) {
        Movie targetMovie = movieRepo.findById(targetMovieId)
                .orElseThrow(() -> new ResourceNotFoundException("Movie", "id", targetMovieId));

        UserRatingProfile profile = loadUserRatingProfile(userId);
        AlgorithmParameters algorithmParameters = loadAlgorithmParameters();

        return predictRatingInternal(userId, targetMovie, profile, algorithmParameters);
    }

    public List<MovieRecommendationDTO> recommendTopKMovies(UUID userId, int k) {
        if (k <= 0) {
            return Collections.emptyList();
        }

        // Load the user's rating profile, which includes their past ratings, the set of movies they've seen, 
        // and their average rating.
        UserRatingProfile profile = loadUserRatingProfile(userId);

        // Cold-start scenario: If the user has no ratings, 
        // recommend top-K movies by IMDb rating with max uncertainty.
        if (profile.ratings().isEmpty()) {
            return buildColdStartRecommendations(k);
        }

        // For non-cold-start users, generate predictions for unseen movies and recommend top-K based on predicted rating and uncertainty.
        AlgorithmParameters algorithmParameters = loadAlgorithmParameters(); // Load algorithm parameters such as max dissimilarity and uncertainty threshold from system config.
        List<Movie> candidates = fetchUnseenCandidates(profile.seenMovieIds());

        return candidates.parallelStream()
                .map(movie -> {
                    RatingPredictionDTO prediction = predictRatingInternal(userId, movie, profile, algorithmParameters);
                    UUID nearestId = prediction.getNearestMovieId();
                    String nearestTitle = null;
                    String nearestPoster = null;
                    if (nearestId != null) {
                        var opt = movieRepo.findById(nearestId);
                        if (opt.isPresent()) {
                            var nm = opt.get();
                            nearestTitle = nm.getTitle();
                            nearestPoster = nm.getPosterUrl();
                        }
                    }
                    return MovieRecommendationDTO.builder()
                            .movieId(movie.getId())
                            .title(movie.getTitle())
                            .posterUrl(movie.getPosterUrl())
                            .predictedRating(prediction.getFinalPrediction())
                            .uncertaintyScore(prediction.getUncertaintyScore())
                            .nearestMovieId(nearestId)
                            .nearestMovieTitle(nearestTitle)
                            .nearestMoviePosterUrl(nearestPoster)
                            .build();
                })
                // Sort by predicted rating (descending) and then by uncertainty score (ascending), and take the top K.
                .sorted(Comparator
                        .comparing(MovieRecommendationDTO::getPredictedRating, Comparator.reverseOrder())
                        .thenComparing(MovieRecommendationDTO::getUncertaintyScore))
                .limit(k)
                .toList();
    }



    private RatingPredictionDTO predictRatingInternal(UUID userId, Movie targetMovie, UserRatingProfile profile,
            AlgorithmParameters algorithmParameters) {

        // If user has no ratings, fallback to IMDb-based prediction with max uncertainty.
        if (profile.ratings().isEmpty()) {
            double fallback = mapImdbToFiveStars(targetMovie.getImdbRating());
            return RatingPredictionDTO.builder()
                    .userId(userId)
                    .targetMovieId(targetMovie.getId())
                    .nearestMovieId(null)
                    .rawPrediction(fallback)
                    .finalPrediction(fallback)
                    .userMeanRating(DEFAULT_USER_MEAN)
                    .minDissimilarity(algorithmParameters.maxDissimilarity())
                    .uncertaintyScore(100.0)
                    .thresholdApplied(false)
                    .build();
        }

        // Find the nearest neighbor movie in the user's rating history based on the lowest dissimilarity score.
        UserRating nearestNeighbor = null;
        double minDissimilarity = Double.MAX_VALUE;

        // Iterate through each of the user's rated movies to find the one most similar to the target movie.
        for (UserRating userRating : profile.ratings()) {
            Movie historicalMovie = userRating.getMovie();
            // If the historical movie is not found (which should not happen if data integrity is maintained), 
            // skip this rating.
            if (historicalMovie == null) {
                continue;
            }

            double dissimilarity = dissimilarityCalculator.calculateTotalDissimilarity(targetMovie, historicalMovie);
            if (dissimilarity < minDissimilarity) {
                minDissimilarity = dissimilarity;
                nearestNeighbor = userRating;
            }
        }

        // If no valid nearest neighbor is found (which is unlikely since user has ratings), fallback to IMDb-based prediction.
        if (nearestNeighbor == null) {
            double fallback = mapImdbToFiveStars(targetMovie.getImdbRating());
            return RatingPredictionDTO.builder()
                    .userId(userId)
                    .targetMovieId(targetMovie.getId())
                    .nearestMovieId(null)
                    .rawPrediction(fallback)
                    .finalPrediction(fallback)
                    .userMeanRating(profile.userMeanRating())
                    .minDissimilarity(algorithmParameters.maxDissimilarity())
                    .uncertaintyScore(100.0)
                    .thresholdApplied(false)
                    .build();
        }

        // Compute the raw prediction based on the nearest neighbor's rating, 
        // then adjust it based on the uncertainty score derived from the dissimilarity.
        double rawPrediction = clampRating(nearestNeighbor.getRatingValue());
        double uncertaintyScore = computeUncertaintyScore(minDissimilarity, algorithmParameters.maxDissimilarity());
        double finalPrediction = rawPrediction;

        boolean thresholdApplied = uncertaintyScore > algorithmParameters.uncertaintyThreshold();
        if (thresholdApplied) {
            finalPrediction = rawPrediction
                    - (rawPrediction - profile.userMeanRating()) * (uncertaintyScore / 100.0);
        }

        return RatingPredictionDTO.builder()
                .userId(userId)
                .targetMovieId(targetMovie.getId())
                .nearestMovieId(nearestNeighbor.getMovie().getId())
                .rawPrediction(rawPrediction)
                .finalPrediction(clampRating(finalPrediction))
                .userMeanRating(profile.userMeanRating())
                .minDissimilarity(minDissimilarity)
                .uncertaintyScore(uncertaintyScore)
                .thresholdApplied(thresholdApplied)
                .build();
    }

    private List<MovieRecommendationDTO> buildColdStartRecommendations(int k) {
        // For cold-start users with no ratings, 
        // recommend top-K movies in our db based on IMDb rating with maximum uncertainty score.
        return movieRepo.findTop1000ByStatusOrderByImdbRatingDesc(MovieStatus.SHOWING)
                .stream()
                .limit(k)
                .map(movie -> MovieRecommendationDTO.builder()
                        .movieId(movie.getId())
                        .title(movie.getTitle())
                        .posterUrl(movie.getPosterUrl())
                        .predictedRating(mapImdbToFiveStars(movie.getImdbRating()))
                        .uncertaintyScore(100.0)
                        .build())
                .toList();
    }

    private List<Movie> fetchUnseenCandidates(Set<UUID> seenMovieIds) {
        if (seenMovieIds == null || seenMovieIds.isEmpty()) {
            return movieRepo.findTop1000ByStatusOrderByImdbRatingDesc(MovieStatus.SHOWING);
        }

        return movieRepo.findByStatusAndIdNotInOrderByImdbRatingDesc(
                MovieStatus.SHOWING,
                seenMovieIds,
                PageRequest.of(0, DEFAULT_CANDIDATE_LIMIT));
    }

    private UserRatingProfile loadUserRatingProfile(UUID userId) {
        if (userId == null) {
            throw new IllegalArgumentException("userId must not be null");
        }
        if (!userRepo.existsById(userId)) {
            throw new ResourceNotFoundException("User", "id", userId);
        }

        List<UserRating> ratings = userRatingRepository.findByUserIdWithMovie(userId);
        Set<UUID> seenMovieIds = userRatingRepository.findDistinctMovieIdsByUserId(userId);
        double meanRating = userRatingService.getUserAverageRating(userId);

        return new UserRatingProfile(ratings, seenMovieIds, meanRating);
    }

    private AlgorithmParameters loadAlgorithmParameters() {
        double maxDissimilarity = getConfigAsDouble(
                AlgorithmConfigKeys.MAX_MOVIE_DISSIMILARITY,
                DEFAULT_MAX_DISSIM);

        if (maxDissimilarity <= 0.0) {
            maxDissimilarity = DEFAULT_MAX_DISSIM;
        }

        double uncertaintyThreshold = getConfigAsDouble(
                AlgorithmConfigKeys.UNCERTAINTY_THRESHOLD,
                DEFAULT_UNCERTAINTY_THRESHOLD);

        return new AlgorithmParameters(maxDissimilarity, uncertaintyThreshold);
    }

    private double getConfigAsDouble(String configKey, double defaultValue) {
        return systemConfigRepository.findById(configKey)
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

    private double computeUncertaintyScore(double minDissimilarity, double maxDissimilarity) {
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
        return clampRating(imdbRating / 2.0);
    }

    private double clampRating(Double ratingValue) {
        if (ratingValue == null) {
            return DEFAULT_USER_MEAN;
        }
        return Math.max(1.0, Math.min(5.0, ratingValue));
    }

    private record UserRatingProfile(List<UserRating> ratings, Set<UUID> seenMovieIds, double userMeanRating) {
    }

    private record AlgorithmParameters(double maxDissimilarity, double uncertaintyThreshold) {
    }
}