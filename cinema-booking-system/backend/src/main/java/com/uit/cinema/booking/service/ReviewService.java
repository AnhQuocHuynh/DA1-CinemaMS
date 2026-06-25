package com.uit.cinema.booking.service;

import com.uit.cinema.booking.dto.request.CreateReviewRequest;
import com.uit.cinema.booking.dto.response.ReviewEligibilityResponse;
import com.uit.cinema.booking.dto.response.ReviewInsightResponse;
import com.uit.cinema.booking.dto.response.ReviewResponse;

import java.util.List;

public interface ReviewService {
    ReviewResponse createReview(CreateReviewRequest request);
    List<ReviewResponse> getMovieReviews(Long movieId);
    List<ReviewResponse> getEventReviews(Long eventId);
    ReviewInsightResponse getMovieInsight(Long movieId);
    ReviewInsightResponse getEventInsight(Long eventId);
    ReviewEligibilityResponse getMovieEligibility(Long userId, Long movieId);
    ReviewEligibilityResponse getEventEligibility(Long userId, Long eventId);
}
