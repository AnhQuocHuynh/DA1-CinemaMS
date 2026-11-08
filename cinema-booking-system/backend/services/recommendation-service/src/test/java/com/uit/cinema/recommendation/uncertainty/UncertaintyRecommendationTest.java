package com.uit.cinema.recommendation.uncertainty;

import com.uit.cinema.recommendation.client.CatalogFeatureClient;
import com.uit.cinema.recommendation.dto.MovieRecommendationResponse;
import com.uit.cinema.recommendation.dto.RatingPredictionResponse;
import com.uit.cinema.recommendation.dto.UserRatingResponse;
import com.uit.cinema.recommendation.persistence.SystemConfig;
import com.uit.cinema.recommendation.persistence.SystemConfigRepository;
import com.uit.cinema.recommendation.persistence.UserRating;
import com.uit.cinema.recommendation.persistence.UserRatingRepository;
import com.uit.cinema.recommendation.service.MovieRecommendationService;
import com.uit.cinema.recommendation.service.UserRatingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UncertaintyRecommendationTest {

    @Mock
    private CatalogFeatureClient catalogFeatureClient;
    @Mock
    private UserRatingRepository userRatingRepository;
    @Mock
    private SystemConfigRepository systemConfigRepository;

    private MovieDissimilarityCalculator calculator;
    private UserRatingService userRatingService;
    private MovieRecommendationService recommendationService;

    @BeforeEach
    void setUp() {
        calculator = new MovieDissimilarityCalculator();
        userRatingService = new UserRatingService(userRatingRepository, catalogFeatureClient);
        recommendationService = new MovieRecommendationService(
                catalogFeatureClient,
                userRatingRepository,
                systemConfigRepository,
                calculator,
                userRatingService);
    }

    @Test
    void numericalAndCategoricalDissimilarityAdd() {
        MovieFeature left = feature(1L, "A", 120, 2020, 8.0, "Action", "en", "US", "SHOWING");
        MovieFeature right = feature(2L, "B", 90, 2018, 6.0, "Drama", "fr", "FR", "SHOWING");

        double numerical = calculator.calculateNumericalDissimilarity(left, right);
        double categorical = calculator.calculateCategoricalDissimilarity(left, right);

        assertEquals(Math.sqrt(30 * 30 + 2 * 2 + 2 * 2), numerical, 0.0001);
        assertEquals(3.0, categorical, 0.0001);
        assertEquals(numerical + categorical, calculator.calculateTotalDissimilarity(left, right), 0.0001);
    }

    @Test
    void coldStartUsesShowingMoviesOrderedByImdb() {
        when(catalogFeatureClient.loadAll()).thenReturn(List.of(
                feature(1L, "Low", 100, 2020, 6.0, "Action", "en", "US", "SHOWING"),
                feature(2L, "High", 100, 2020, 9.0, "Action", "en", "US", "SHOWING"),
                feature(3L, "Soon", 100, 2026, 10.0, "Action", "en", "US", "UPCOMING")));
        when(userRatingRepository.findByUserIdOrderByCreatedAtDesc(7L)).thenReturn(List.of());
        when(userRatingRepository.findAverageRatingByUserId(7L)).thenReturn(null);

        List<MovieRecommendationResponse> result = recommendationService.recommendTopKMovies(7L, 1);

        assertEquals(1, result.size());
        assertEquals(2L, result.get(0).movieId());
        assertEquals(4.5, result.get(0).predictedRating(), 0.0001);
        assertEquals(100.0, result.get(0).uncertaintyScore(), 0.0001);
        assertNull(result.get(0).nearestMovieId());
    }

    @Test
    void highUncertaintyPullsPredictionTowardMeanAndKeepsNearestTitle() {
        MovieFeature liked = feature(10L, "Liked", 100, 2020, 8.0, "Action", "en", "US", "SHOWING");
        MovieFeature close = feature(11L, "Close", 100, 2020, 8.0, "Action", "en", "US", "SHOWING");
        MovieFeature far = feature(12L, "Far", 100, 2020, 8.0, "Drama", "en", "US", "SHOWING");
        when(catalogFeatureClient.loadAll()).thenReturn(List.of(liked, close, far));
        when(userRatingRepository.findByUserIdOrderByCreatedAtDesc(7L)).thenReturn(List.of(stored(10L, 5.0, liked)));
        when(userRatingRepository.findAverageRatingByUserId(7L)).thenReturn(3.0);
        when(systemConfigRepository.findById(AlgorithmConfigKeys.MAX_MOVIE_DISSIMILARITY)).thenReturn(Optional.of(config("2")));
        when(systemConfigRepository.findById(AlgorithmConfigKeys.UNCERTAINTY_THRESHOLD)).thenReturn(Optional.of(config("12")));

        List<MovieRecommendationResponse> result = recommendationService.recommendTopKMovies(7L, 2);

        assertEquals(11L, result.get(0).movieId());
        assertEquals(5.0, result.get(0).predictedRating(), 0.0001);
        assertEquals(0.0, result.get(0).uncertaintyScore(), 0.0001);
        assertEquals("Liked", result.get(0).nearestMovieTitle());
        assertTrue(result.get(1).uncertaintyScore() > 12.0);
        assertTrue(result.get(1).predictedRating() < 5.0);
        assertTrue(result.get(1).predictedRating() > 3.0);
    }

    @Test
    void predictAppliesThresholdFormula() {
        MovieFeature liked = feature(10L, "Liked", 0, 0, 0.0, "a", "", "", "SHOWING");
        MovieFeature target = feature(12L, "Far", 0, 0, 0.0, "b", "", "", "SHOWING");
        when(catalogFeatureClient.requireFeature(12L)).thenReturn(target);
        when(catalogFeatureClient.loadAll()).thenReturn(List.of(liked, target));
        when(userRatingRepository.findByUserIdOrderByCreatedAtDesc(7L)).thenReturn(List.of(stored(10L, 5.0, liked)));
        when(userRatingRepository.findAverageRatingByUserId(7L)).thenReturn(3.0);
        when(systemConfigRepository.findById(AlgorithmConfigKeys.MAX_MOVIE_DISSIMILARITY)).thenReturn(Optional.of(config("2")));
        when(systemConfigRepository.findById(AlgorithmConfigKeys.UNCERTAINTY_THRESHOLD)).thenReturn(Optional.of(config("12")));

        RatingPredictionResponse prediction = recommendationService.predictRating(7L, 12L);

        assertEquals(5.0, prediction.rawPrediction(), 0.0001);
        assertEquals(50.0, prediction.uncertaintyScore(), 0.0001);
        assertTrue(prediction.thresholdApplied());
        assertEquals(4.0, prediction.finalPrediction(), 0.0001);
        assertEquals(10L, prediction.nearestMovieId());
    }

    @Test
    void upsertUpdatesTheLatestRatingForTheSameMovie() {
        MovieFeature movie = feature(4L, "Dune", 155, 2021, 8.0, "Sci-Fi", "en", "US", "SHOWING");
        when(catalogFeatureClient.requireFeature(4L)).thenReturn(movie);
        UserRating existing = stored(4L, 2.0, movie);
        existing.setRatingId(9L);
        when(userRatingRepository.findFirstByUserIdAndMovieIdOrderByCreatedAtDesc(7L, 4L)).thenReturn(Optional.of(existing));
        when(userRatingRepository.save(any(UserRating.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserRatingResponse saved = userRatingService.upsert(7L, 4L, 4.5);

        assertEquals(9L, saved.ratingId());
        assertEquals(4.5, saved.ratingValue(), 0.0001);
        assertEquals("Dune", saved.movieTitle());
        assertEquals(4.5, existing.getRatingValue(), 0.0001);
    }

    private static SystemConfig config(String value) {
        SystemConfig config = new SystemConfig();
        config.setConfigKey("key");
        config.setConfigValue(value);
        return config;
    }

    private static UserRating stored(Long movieId, double rating, MovieFeature feature) {
        UserRating ratingRow = new UserRating();
        ratingRow.setUserId(7L);
        ratingRow.setMovieId(movieId);
        ratingRow.setRatingValue(rating);
        ratingRow.setMovieTitle(feature.title());
        ratingRow.setPosterUrl(feature.posterUrl());
        ratingRow.setDurationMinutes(feature.durationMinutes());
        ratingRow.setReleaseYear(feature.releaseYear());
        ratingRow.setImdbRating(feature.imdbRating());
        ratingRow.setRegion(feature.region());
        ratingRow.setLanguage(feature.language());
        ratingRow.setGenreCsv(feature.genreCsv());
        return ratingRow;
    }

    private static MovieFeature feature(
            Long id,
            String title,
            int duration,
            int year,
            double imdb,
            String genre,
            String language,
            String region,
            String status
    ) {
        return new MovieFeature(id, title, "poster-" + id, duration, year, imdb, region, language, genre, status, "tt" + id);
    }
}
