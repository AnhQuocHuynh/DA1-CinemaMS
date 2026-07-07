package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.dto.request.CreateReviewRequest;
import com.uit.cinema.booking.dto.response.ReviewEligibilityResponse;
import com.uit.cinema.booking.dto.response.ReviewInsightResponse;
import com.uit.cinema.booking.dto.response.ReviewResponse;
import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Review;
import com.uit.cinema.booking.mapper.ReviewMapper;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.ReviewRepository;
import com.uit.cinema.booking.service.ReviewService;
import com.uit.cinema.catalog.service.CatalogReadService;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.service.SeatReservationService;
import com.uit.cinema.showtime.service.contract.ShowtimeScheduleView;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ReviewServiceImpl implements ReviewService {

    private final ReviewRepository reviewRepository;
    private final ReviewMapper reviewMapper;
    private final OrderRepository orderRepository;
    private final SeatReservationService seatReservationService;
    private final CatalogReadService catalogReadService;

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
        if (request.getMovieId() != null) {
            ReviewEligibilityResponse eligibility = getMovieEligibility(request.getUserId(), request.getMovieId());
            if (!Boolean.TRUE.equals(eligibility.getEligible())) {
                throw new CustomException(eligibility.getMessage(), HttpStatus.BAD_REQUEST, eligibility.getReasonCode());
            }
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

    @Override
    public ReviewEligibilityResponse getMovieEligibility(Long userId, Long movieId) {
        if (!catalogReadService.movieExists(movieId)) {
            throw new CustomException("Movie not found", HttpStatus.NOT_FOUND, "MOVIE_NOT_FOUND");
        }
        boolean hasReviewed = reviewRepository.existsByUserIdAndMovieId(userId, movieId);
        if (hasReviewed) {
            return reviewEligibility(userId, movieId, null, false, true, false, false, "REVIEW_DUPLICATED", "Ban da danh gia phim nay");
        }

        List<Order> paidOrders = orderRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
            .filter(order -> order.getStatus() == Order.OrderStatus.PAID)
            .toList();
        boolean hasPaidTicket = false;
        boolean watched = false;
        LocalDateTime now = LocalDateTime.now();
        for (Order order : paidOrders) {
            Optional<ShowtimeScheduleView> showtime = seatReservationService.findSchedule(order.getShowtimeId());
            if (showtime.isEmpty() || !movieId.equals(showtime.get().movieId())) {
                continue;
            }
            hasPaidTicket = true;
            // Allow review if the showtime has started or ended
            if ("ENDED".equals(showtime.get().status()) ||
                (showtime.get().startTime() != null && !showtime.get().startTime().isAfter(now)) ||
                (showtime.get().endTime() != null && !showtime.get().endTime().isAfter(now))) {
                watched = true;
                break;
            }
        }

        if (!hasPaidTicket) {
            return reviewEligibility(userId, movieId, null, false, false, false, false, "REVIEW_REQUIRES_PAID_TICKET", "Ban can mua ve phim nay truoc khi danh gia");
        }
        if (!watched) {
            return reviewEligibility(userId, movieId, null, false, false, true, false, "REVIEW_REQUIRES_WATCHED_SHOWTIME", "Chi co the danh gia sau khi suat chieu ket thuc");
        }
        return reviewEligibility(userId, movieId, null, true, false, true, true, null, "Co the danh gia phim nay");
    }

    @Override
    public ReviewEligibilityResponse getEventEligibility(Long userId, Long eventId) {
        if (!catalogReadService.eventExists(eventId)) {
            throw new CustomException("Event not found", HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND");
        }
        boolean hasReviewed = reviewRepository.existsByUserIdAndEventId(userId, eventId);
        if (hasReviewed) {
            return reviewEligibility(userId, null, eventId, false, true, false, false, "REVIEW_DUPLICATED", "Ban da danh gia su kien nay");
        }
        return reviewEligibility(userId, null, eventId, true, false, false, false, null, "Co the danh gia su kien nay");
    }

    private void validateTarget(Long movieId, Long eventId) {
        if ((movieId == null && eventId == null) || (movieId != null && eventId != null)) {
            throw new CustomException("Only one target is allowed: movieId or eventId", HttpStatus.BAD_REQUEST, "REVIEW_TARGET_INVALID");
        }
        if (movieId != null && !catalogReadService.movieExists(movieId)) {
            throw new CustomException("Movie not found", HttpStatus.NOT_FOUND, "MOVIE_NOT_FOUND");
        }
        if (eventId != null && !catalogReadService.eventExists(eventId)) {
            throw new CustomException("Event not found", HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND");
        }
    }

    private ReviewEligibilityResponse reviewEligibility(
        Long userId,
        Long movieId,
        Long eventId,
        boolean eligible,
        boolean hasReviewed,
        boolean hasPaidTicket,
        boolean watched,
        String reasonCode,
        String message
    ) {
        return ReviewEligibilityResponse.builder()
            .userId(userId)
            .movieId(movieId)
            .eventId(eventId)
            .eligible(eligible)
            .hasReviewed(hasReviewed)
            .hasPaidTicket(hasPaidTicket)
            .watched(watched)
            .reasonCode(reasonCode)
            .message(message)
            .build();
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
