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
import com.uit.cinema.catalog.service.CatalogReadService;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.service.SeatReservationService;
import com.uit.cinema.showtime.service.contract.ShowtimeScheduleView;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReviewServiceImplTest {

    @Mock
    private ReviewRepository reviewRepository;
    @Mock
    private ReviewMapper reviewMapper;
    @Mock
    private OrderRepository orderRepository;
    @Mock
    private SeatReservationService seatReservationService;
    @Mock
    private CatalogReadService catalogReadService;

    @InjectMocks
    private ReviewServiceImpl reviewService;

    @Test
    void createReview_WithMovie_Success() {
        CreateReviewRequest request = new CreateReviewRequest();
        request.setUserId(1L);
        request.setMovieId(1L);
        request.setRating(5);
        request.setComment("Great movie!");
        when(catalogReadService.movieExists(1L)).thenReturn(true);
        when(reviewRepository.existsByUserIdAndMovieId(1L, 1L)).thenReturn(false);

        Order paidOrder = new Order();
        paidOrder.setStatus(Order.OrderStatus.PAID);
        paidOrder.setShowtimeId(1L);
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(paidOrder));
        when(seatReservationService.findSchedule(1L)).thenReturn(Optional.of(scheduleForMovie(1L, LocalDateTime.now().minusHours(2), "ENDED")));

        Review review = new Review();
        review.setId(1L);
        when(reviewMapper.toEntity(request)).thenReturn(review);
        when(reviewRepository.save(any(Review.class))).thenReturn(review);

        ReviewResponse mockResponse = new ReviewResponse();
        when(reviewMapper.toResponse(review)).thenReturn(mockResponse);

        ReviewResponse response = reviewService.createReview(request);

        assertNotNull(response);
        verify(reviewRepository).save(any(Review.class));
    }

    @Test
    void createReview_WithDuplicateTarget_ThrowsException() {
        CreateReviewRequest request = new CreateReviewRequest();
        request.setUserId(1L);
        request.setMovieId(1L);
        request.setRating(5);
        request.setComment("Great movie!");
        when(catalogReadService.movieExists(1L)).thenReturn(true);
        when(reviewRepository.existsByUserIdAndMovieId(1L, 1L)).thenReturn(true);

        CustomException exception = assertThrows(CustomException.class, () -> reviewService.createReview(request));
        assertEquals("REVIEW_DUPLICATED", exception.getErrorCode());
    }

    @Test
    void createReview_WithBothTargets_ThrowsException() {
        CreateReviewRequest request = new CreateReviewRequest();
        request.setUserId(1L);
        request.setMovieId(1L);
        request.setEventId(1L);
        request.setRating(5);
        request.setComment("Confusing");

        CustomException exception = assertThrows(CustomException.class, () -> reviewService.createReview(request));
        assertEquals("REVIEW_TARGET_INVALID", exception.getErrorCode());
    }

    @Test
    void getMovieEligibility_WhenEligible_ReturnsTrue() {
        when(catalogReadService.movieExists(1L)).thenReturn(true);
        when(reviewRepository.existsByUserIdAndMovieId(1L, 1L)).thenReturn(false);

        Order paidOrder = new Order();
        paidOrder.setStatus(Order.OrderStatus.PAID);
        paidOrder.setShowtimeId(10L);
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(paidOrder));
        when(seatReservationService.findSchedule(10L)).thenReturn(Optional.of(scheduleForMovie(1L, LocalDateTime.now().minusHours(2), "ENDED")));

        ReviewEligibilityResponse eligibility = reviewService.getMovieEligibility(1L, 1L);

        assertTrue(eligibility.getEligible());
        assertTrue(eligibility.getHasPaidTicket());
        assertTrue(eligibility.getWatched());
        assertFalse(eligibility.getHasReviewed());
    }

    @Test
    void getMovieEligibility_WhenNotWatched_ReturnsFalse() {
        when(catalogReadService.movieExists(1L)).thenReturn(true);
        when(reviewRepository.existsByUserIdAndMovieId(1L, 1L)).thenReturn(false);

        Order paidOrder = new Order();
        paidOrder.setStatus(Order.OrderStatus.PAID);
        paidOrder.setShowtimeId(10L);
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(paidOrder));
        when(seatReservationService.findSchedule(10L)).thenReturn(Optional.of(scheduleForMovie(1L, LocalDateTime.now().plusHours(4), "SCHEDULED")));

        ReviewEligibilityResponse eligibility = reviewService.getMovieEligibility(1L, 1L);

        assertFalse(eligibility.getEligible());
        assertTrue(eligibility.getHasPaidTicket());
        assertFalse(eligibility.getWatched());
        assertEquals("REVIEW_REQUIRES_WATCHED_SHOWTIME", eligibility.getReasonCode());
    }

    @Test
    void getMovieEligibility_WhenNoPaidTicket_ReturnsFalse() {
        when(catalogReadService.movieExists(1L)).thenReturn(true);
        when(reviewRepository.existsByUserIdAndMovieId(1L, 1L)).thenReturn(false);

        Order unpaidOrder = new Order();
        unpaidOrder.setStatus(Order.OrderStatus.CANCELLED);
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(unpaidOrder));

        ReviewEligibilityResponse eligibility = reviewService.getMovieEligibility(1L, 1L);

        assertFalse(eligibility.getEligible());
        assertFalse(eligibility.getHasPaidTicket());
        assertEquals("REVIEW_REQUIRES_PAID_TICKET", eligibility.getReasonCode());
    }

    @Test
    void getMovieInsight_CalculatesAverageAndDistribution() {
        Review r1 = new Review(); r1.setRating(5);
        Review r2 = new Review(); r2.setRating(5);
        Review r3 = new Review(); r3.setRating(2);

        when(reviewRepository.findByMovieIdAndStatusOrderByCreatedAtDesc(1L, Review.ReviewStatus.VISIBLE))
            .thenReturn(List.of(r1, r2, r3));

        ReviewInsightResponse insight = reviewService.getMovieInsight(1L);

        assertEquals(3, insight.getTotalReviews());
        assertEquals(4.0, insight.getAverageRating());
        assertEquals(2, insight.getFiveStarCount());
        assertEquals(1, insight.getTwoStarCount());
        assertEquals(0, insight.getOneStarCount());
    }

    private ShowtimeScheduleView scheduleForMovie(Long movieId, LocalDateTime endTime, String status) {
        return new ShowtimeScheduleView(
            10L,
            movieId,
            null,
            2L,
            endTime.minusHours(2),
            endTime,
            status
        );
    }
}
