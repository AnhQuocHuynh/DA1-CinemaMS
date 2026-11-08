package com.uit.cinema.recommendation.controller;

import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.recommendation.dto.MovieRecommendationResponse;
import com.uit.cinema.recommendation.dto.RatingPredictionResponse;
import com.uit.cinema.recommendation.dto.UserRatingPageResponse;
import com.uit.cinema.recommendation.dto.UserRatingRequest;
import com.uit.cinema.recommendation.dto.UserRatingResponse;
import com.uit.cinema.recommendation.security.AuthenticatedUserIdResolver;
import com.uit.cinema.recommendation.service.MovieRecommendationService;
import com.uit.cinema.recommendation.service.UserRatingService;
import com.uit.cinema.recommendation.uncertainty.AlgorithmScheduledTasks;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/recommendations")
@RequiredArgsConstructor
public class UncertaintyRecommendationController {

    private final MovieRecommendationService movieRecommendationService;
    private final UserRatingService userRatingService;
    private final AlgorithmScheduledTasks algorithmScheduledTasks;
    private final AuthenticatedUserIdResolver userIdResolver;

    @GetMapping("/top-k")
    public ResponseEntity<ApiResponse<List<MovieRecommendationResponse>>> topK(
            @RequestParam(defaultValue = "10") int k
    ) {
        Long userId = userIdResolver.requireCurrentUserId();
        return ResponseEntity.ok(ApiResponse.success(
                movieRecommendationService.recommendTopKMovies(userId, k),
                "Top-k recommendations loaded"));
    }

    @GetMapping("/predict")
    public ResponseEntity<ApiResponse<RatingPredictionResponse>> predict(@RequestParam Long targetMovieId) {
        Long userId = userIdResolver.requireCurrentUserId();
        return ResponseEntity.ok(ApiResponse.success(
                movieRecommendationService.predictRating(userId, targetMovieId),
                "Rating prediction loaded"));
    }

    @GetMapping("/user-ratings/me")
    public ResponseEntity<ApiResponse<List<UserRatingResponse>>> myRatings() {
        Long userId = userIdResolver.requireCurrentUserId();
        return ResponseEntity.ok(ApiResponse.success(userRatingService.listMine(userId), "Ratings loaded"));
    }

    @GetMapping("/user-ratings/me/list")
    public ResponseEntity<ApiResponse<UserRatingPageResponse>> myRatingsPage(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Long userId = userIdResolver.requireCurrentUserId();
        return ResponseEntity.ok(ApiResponse.success(userRatingService.listMinePage(userId, page, size), "Ratings loaded"));
    }

    @PostMapping("/user-ratings")
    public ResponseEntity<ApiResponse<UserRatingResponse>> upsert(@Valid @RequestBody UserRatingRequest request) {
        Long userId = userIdResolver.requireCurrentUserId();
        UserRatingResponse saved = userRatingService.upsert(userId, request.movieId(), request.ratingValue());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(saved, "Rating saved"));
    }

    @DeleteMapping("/user-ratings/{movieId}")
    public ResponseEntity<Void> delete(@PathVariable Long movieId) {
        Long userId = userIdResolver.requireCurrentUserId();
        userRatingService.delete(userId, movieId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/max-dissimilarity/recalculate")
    public ResponseEntity<ApiResponse<Map<String, String>>> recalculate() {
        algorithmScheduledTasks.calculateAndStoreMaxMovieDissimilarity();
        return ResponseEntity.ok(ApiResponse.success(
                Map.of("message", "MAX_MOVIE_DISSIMILARITY recalculated successfully"),
                "Max dissimilarity recalculated"));
    }
}
