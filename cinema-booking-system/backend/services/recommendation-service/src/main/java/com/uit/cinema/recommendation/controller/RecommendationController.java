package com.uit.cinema.recommendation.controller;

import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.recommendation.dto.RecommendationResponse;
import com.uit.cinema.recommendation.dto.TasteProfileResponse;
import com.uit.cinema.recommendation.service.RecommendationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/recommendations")
public class RecommendationController {

    private final RecommendationService recommendationService;

    public RecommendationController(RecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    @GetMapping("/movies")
    public ResponseEntity<ApiResponse<RecommendationResponse>> getRecommendations(
        @RequestParam(name = "userId", required = false) Long userId,
        @RequestParam(name = "limit", defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(ApiResponse.success(
            recommendationService.recommendForUser(userId, limit),
            "Recommendations loaded"
        ));
    }

    @GetMapping("/movies/popular")
    public ResponseEntity<ApiResponse<RecommendationResponse>> getPopularMovies(
        @RequestParam(name = "limit", defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(ApiResponse.success(
            recommendationService.popularMovies(limit),
            "Popular recommendations loaded"
        ));
    }

    @GetMapping("/movies/{movieId}/similar")
    public ResponseEntity<ApiResponse<RecommendationResponse>> getSimilarMovies(
        @PathVariable("movieId") Long movieId,
        @RequestParam(name = "limit", defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(ApiResponse.success(
            recommendationService.similarMovies(movieId, limit),
            "Similar recommendations loaded"
        ));
    }

    @GetMapping("/users/{userId}/taste-profile")
    public ResponseEntity<ApiResponse<TasteProfileResponse>> getTasteProfile(@PathVariable("userId") Long userId) {
        return ResponseEntity.ok(ApiResponse.success(
            recommendationService.tasteProfile(userId),
            "Taste profile loaded"
        ));
    }
}
