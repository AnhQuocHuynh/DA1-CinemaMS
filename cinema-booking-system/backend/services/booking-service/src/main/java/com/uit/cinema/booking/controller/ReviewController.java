package com.uit.cinema.booking.controller;

import com.uit.cinema.booking.dto.request.CreateReviewRequest;
import com.uit.cinema.booking.dto.response.ReviewEligibilityResponse;
import com.uit.cinema.booking.dto.response.ReviewInsightResponse;
import com.uit.cinema.booking.dto.response.ReviewResponse;
import com.uit.cinema.booking.security.AuthenticatedUserIdResolver;
import com.uit.cinema.booking.service.ReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;
    private final AuthenticatedUserIdResolver userIdResolver;

    @PostMapping
    public ResponseEntity<ReviewResponse> create(@Valid @RequestBody CreateReviewRequest request) {
        request.setUserId(userIdResolver.resolveSelf(request.getUserId()));
        return ResponseEntity.ok(reviewService.createReview(request));
    }

    @GetMapping("/movies/{movieId}")
    public ResponseEntity<List<ReviewResponse>> getMovieReviews(@PathVariable Long movieId) {
        return ResponseEntity.ok(reviewService.getMovieReviews(movieId));
    }

    @GetMapping("/events/{eventId}")
    public ResponseEntity<List<ReviewResponse>> getEventReviews(@PathVariable Long eventId) {
        return ResponseEntity.ok(reviewService.getEventReviews(eventId));
    }

    @GetMapping("/movies/{movieId}/insight")
    public ResponseEntity<ReviewInsightResponse> getMovieInsight(@PathVariable Long movieId) {
        return ResponseEntity.ok(reviewService.getMovieInsight(movieId));
    }

    @GetMapping("/events/{eventId}/insight")
    public ResponseEntity<ReviewInsightResponse> getEventInsight(@PathVariable Long eventId) {
        return ResponseEntity.ok(reviewService.getEventInsight(eventId));
    }

    @GetMapping("/movies/{movieId}/eligibility")
    public ResponseEntity<ReviewEligibilityResponse> getMovieEligibility(
        @PathVariable Long movieId,
        @RequestParam Long userId
    ) {
        Long authorizedUserId = userIdResolver.authorizeRequestedUser(userId);
        return ResponseEntity.ok(reviewService.getMovieEligibility(authorizedUserId, movieId));
    }

    @GetMapping("/events/{eventId}/eligibility")
    public ResponseEntity<ReviewEligibilityResponse> getEventEligibility(
        @PathVariable Long eventId,
        @RequestParam Long userId
    ) {
        Long authorizedUserId = userIdResolver.authorizeRequestedUser(userId);
        return ResponseEntity.ok(reviewService.getEventEligibility(authorizedUserId, eventId));
    }
}
