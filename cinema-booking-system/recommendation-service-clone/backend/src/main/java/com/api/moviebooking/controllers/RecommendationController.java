package com.api.moviebooking.controllers;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.api.moviebooking.models.dtos.recommendation.MovieRecommendationDTO;
import com.api.moviebooking.models.dtos.recommendation.RatingPredictionDTO;
import com.api.moviebooking.models.dtos.imdb.ImdbTitleDTO;
import com.api.moviebooking.models.entities.Movie;
import com.api.moviebooking.models.entities.User;
import com.api.moviebooking.services.AlgorithmScheduledTasks;
import com.api.moviebooking.services.ImdbSyncService;
import com.api.moviebooking.services.MovieRecommendationService;
import com.api.moviebooking.services.UserService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping("/recommendations")
@Tag(name = "Movie Recommendation Algorithm")
public class RecommendationController {

    private final MovieRecommendationService movieRecommendationService;
    private final ImdbSyncService imdbSyncService;
    private final AlgorithmScheduledTasks algorithmScheduledTasks;
    private final UserService userService;

    @GetMapping("/predict")
    @PreAuthorize("isAuthenticated()")
    @SecurityRequirement(name = "bearerToken")
    @Operation(summary = "Predict rating for a target movie by current user")
    public ResponseEntity<RatingPredictionDTO> predictRating(@RequestParam UUID targetMovieId) {
        UUID currentUserId = getCurrentUserId();
        RatingPredictionDTO prediction = movieRecommendationService.predictRating(currentUserId, targetMovieId);
        return ResponseEntity.ok(prediction);
    }

    @GetMapping("/top-k")
    @PreAuthorize("isAuthenticated()")
    @SecurityRequirement(name = "bearerToken")
    @Operation(summary = "Recommend top-K movies for current user")
    public ResponseEntity<List<MovieRecommendationDTO>> recommendTopKMovies(@RequestParam(defaultValue = "10") int k) {
        UUID currentUserId = getCurrentUserId();
        List<MovieRecommendationDTO> recommendations = movieRecommendationService.recommendTopKMovies(currentUserId, k);
        return ResponseEntity.ok(recommendations);
    }

    @GetMapping("/imdb/titles")
    @PreAuthorize("isAuthenticated()")
    @SecurityRequirement(name = "bearerToken")
    @Operation(summary = "Get movie title list from IMDb API")
    public ResponseEntity<List<ImdbTitleDTO>> getImdbTitles(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Integer limit) {
        List<ImdbTitleDTO> titles = imdbSyncService.getTitlesFromImdb(query, limit);
        return ResponseEntity.ok(titles);
    }

    @PostMapping("/imdb-sync/{imdbId}")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "bearerToken")
    @Operation(summary = "Sync movie metadata from IMDb and upsert into movies")
    public ResponseEntity<Map<String, Object>> syncMovieFromImdb(@PathVariable String imdbId) {
        Movie movie = imdbSyncService.syncMovieByImdbId(imdbId);

        Map<String, Object> response = Map.of(
                "movieId", movie.getId(),
                "imdbId", movie.getImdbId(),
                "title", movie.getTitle(),
                "message", "IMDb sync completed");

        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @PostMapping("/max-dissimilarity/recalculate")
    @PreAuthorize("hasRole('ADMIN')")
    @SecurityRequirement(name = "bearerToken")
    @Operation(summary = "Trigger MAX_MOVIE_DISSIMILARITY recalculation manually")
    public ResponseEntity<Map<String, String>> recalculateMaxDissimilarity() {
        algorithmScheduledTasks.calculateAndStoreMaxMovieDissimilarity();
        return ResponseEntity.ok(Map.of("message", "MAX_MOVIE_DISSIMILARITY recalculated successfully"));
    }

    private UUID getCurrentUserId() {
        User currentUser = userService.getCurrentUser();
        return currentUser.getId();
    }
}