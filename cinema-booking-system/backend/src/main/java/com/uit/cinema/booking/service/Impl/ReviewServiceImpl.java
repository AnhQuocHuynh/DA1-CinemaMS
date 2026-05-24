package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.dto.request.CreateReviewRequest;
import com.uit.cinema.booking.dto.response.ReviewInsightResponse;
import com.uit.cinema.booking.dto.response.ReviewResponse;
import com.uit.cinema.booking.entity.Review;
import com.uit.cinema.booking.mapper.ReviewMapper;
import com.uit.cinema.booking.repository.ReviewRepository;
import com.uit.cinema.booking.service.ReviewService;
import com.uit.cinema.core.exception.CustomException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ReviewServiceImpl implements ReviewService {

    private final ReviewRepository reviewRepository;
    private final ReviewMapper reviewMapper;

    @Override
    @Transactional
    public ReviewResponse createReview(CreateReviewRequest request) {
        validateTarget(request.getMovieId(), request.getEventId());

        boolean duplicate = request.getMovieId() != null
            ? reviewRepository.existsByUserIdAndMovieId(request.getUserId(), request.getMovieId())
            : reviewRepository.existsByUserIdAndEventId(request.getUserId(), request.getEventId());
        if (duplicate) {
            throw new CustomException("Ban da danh gia noi dung nay", HttpStatus.CONFLICT, "REVIEW_DUPLICATED");
        }

        Review review = reviewMapper.toEntity(request);
        review.setStatus(Review.ReviewStatus.VISIBLE);
        return reviewMapper.toResponse(reviewRepository.save(review));
    }

    @Override
    public List<ReviewResponse> getMovieReviews(Long movieId) {
        return reviewRepository.findByMovieIdAndStatusOrderByCreatedAtDesc(movieId, Review.ReviewStatus.VISIBLE)
            .stream().map(reviewMapper::toResponse).toList();
    }

    @Override
    public List<ReviewResponse> getEventReviews(Long eventId) {
        return reviewRepository.findByEventIdAndStatusOrderByCreatedAtDesc(eventId, Review.ReviewStatus.VISIBLE)
            .stream().map(reviewMapper::toResponse).toList();
    }

    @Override
    public ReviewInsightResponse getMovieInsight(Long movieId) {
        List<Review> reviews = reviewRepository.findByMovieIdAndStatusOrderByCreatedAtDesc(movieId, Review.ReviewStatus.VISIBLE);
        double avg = reviews.stream().mapToInt(Review::getRating).average().orElse(0.0);
        return buildInsight(movieId, null, reviews, avg);
    }

    @Override
    public ReviewInsightResponse getEventInsight(Long eventId) {
        List<Review> reviews = reviewRepository.findByEventIdAndStatusOrderByCreatedAtDesc(eventId, Review.ReviewStatus.VISIBLE);
        double avg = reviews.stream().mapToInt(Review::getRating).average().orElse(0.0);
        return buildInsight(null, eventId, reviews, avg);
    }

    private void validateTarget(Long movieId, Long eventId) {
        if ((movieId == null && eventId == null) || (movieId != null && eventId != null)) {
            throw new CustomException("Only one target is allowed: movieId or eventId", HttpStatus.BAD_REQUEST, "REVIEW_TARGET_INVALID");
        }
    }

    private ReviewInsightResponse buildInsight(Long movieId, Long eventId, List<Review> reviews, double avg) {
        return ReviewInsightResponse.builder()
            .movieId(movieId)
            .eventId(eventId)
            .totalReviews(reviews.size())
            .averageRating(avg)
            .oneStarCount(reviews.stream().filter(r -> r.getRating() == 1).count())
            .twoStarCount(reviews.stream().filter(r -> r.getRating() == 2).count())
            .threeStarCount(reviews.stream().filter(r -> r.getRating() == 3).count())
            .fourStarCount(reviews.stream().filter(r -> r.getRating() == 4).count())
            .fiveStarCount(reviews.stream().filter(r -> r.getRating() == 5).count())
            .build();
    }
}
