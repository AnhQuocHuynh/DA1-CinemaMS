package com.api.moviebooking.controllers;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.api.moviebooking.models.dtos.recommendation.UserRatingDTO;
import com.api.moviebooking.models.dtos.recommendation.UserRatingRequestDTO;
import com.api.moviebooking.models.entities.User;
import com.api.moviebooking.services.UserRatingService;
import com.api.moviebooking.services.UserService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping("/user-ratings")
@Tag(name = "User Movie Ratings")
public class UserRatingController {

    private final UserRatingService userRatingService;
    private final UserService userService;

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    @SecurityRequirement(name = "bearerToken")
    @Operation(summary = "Get all ratings from current user")
    public ResponseEntity<List<UserRatingDTO>> getMyRatings() {
        UUID currentUserId = getCurrentUserId();
        List<UserRatingDTO> ratings = userRatingService.getUserRatings(currentUserId);
        return ResponseEntity.ok(ratings);
    }

    @GetMapping("/me/list")
    @PreAuthorize("isAuthenticated()")
    @SecurityRequirement(name = "bearerToken")
    @Operation(summary = "Get paged ratings from current user")
    public ResponseEntity<Map<String, Object>> getMyRatingsPaged(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "0") int page,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "20") int size) {
        UUID currentUserId = getCurrentUserId();
        var pageRes = userRatingService.getUserRatingsPage(currentUserId, page, size);
        Map<String, Object> body = Map.of(
                "data", pageRes.getContent(),
                "page", pageRes.getNumber(),
                "size", pageRes.getSize(),
                "totalElements", pageRes.getTotalElements(),
                "totalPages", pageRes.getTotalPages());
        return ResponseEntity.ok(body);
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    @SecurityRequirement(name = "bearerToken")
    @Operation(summary = "Create or update a movie rating for current user")
    public ResponseEntity<UserRatingDTO> upsertRating(@Valid @RequestBody UserRatingRequestDTO request) {
        UUID currentUserId = getCurrentUserId();
        UserRatingDTO response = userRatingService.upsertUserRating(
                currentUserId,
                request.getMovieId(),
                request.getRatingValue());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/{movieId}")
    @PreAuthorize("isAuthenticated()")
    @SecurityRequirement(name = "bearerToken")
    @Operation(summary = "Delete current user's rating for a movie")
    public ResponseEntity<Void> deleteRating(@PathVariable UUID movieId) {
        UUID currentUserId = getCurrentUserId();
        userRatingService.deleteUserRating(currentUserId, movieId);
        return ResponseEntity.noContent().build();
    }

    private UUID getCurrentUserId() {
        User currentUser = userService.getCurrentUser();
        return currentUser.getId();
    }
}
