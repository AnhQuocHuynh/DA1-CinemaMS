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
import com.uit.cinema.catalog.repository.EventRepository;
import com.uit.cinema.catalog.repository.MovieRepository;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.entity.Showtime;
import com.uit.cinema.showtime.repository.ShowtimeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReviewServiceImplTest {

    @Mock
    private ReviewRepository reviewRepository;
    @Mock
    private ReviewMapper reviewMapper;
    @Mock
    private OrderRepository orderRepository;
    @Mock
    private ShowtimeRepository showtimeRepository;
    @Mock
    private MovieRepository movieRepository;
    @Mock
    private EventRepository eventRepository;

    @InjectMocks
    private ReviewServiceImpl reviewService;

    // --- createReview Tests ---

    @Test
    void createReview_WithMovie_Success() {
        CreateReviewRequest request = new CreateReviewRequest();
        request.setUserId(1L);
        request.setMovieId(1L);
        request.setRating(5);
        request.setComment("Great movie!");
        when(movieRepository.existsById(1L)).thenReturn(true);
        when(reviewRepository.existsByUserIdAndMovieId(1L, 1L)).thenReturn(false);

        Order paidOrder = new Order();
        paidOrder.setStatus(Order.OrderStatus.PAID);
        paidOrder.setShowtimeId(1L);
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(paidOrder));

        Showtime showtime = new Showtime();
        showtime.setMovieId(1L);
        showtime.setEndTime(LocalDateTime.now().minusHours(1)); // Watched
        when(showtimeRepository.findById(1L)).thenReturn(Optional.of(showtime));

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
        when(movieRepository.existsById(1L)).thenReturn(true);
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

    // --- getMovieEligibility Tests ---

    @Test
    void getMovieEligibility_WhenEligible_ReturnsTrue() {
        when(movieRepository.existsById(1L)).thenReturn(true);
        when(reviewRepository.existsByUserIdAndMovieId(1L, 1L)).thenReturn(false);

        Order paidOrder = new Order();
        paidOrder.setStatus(Order.OrderStatus.PAID);
        paidOrder.setShowtimeId(10L);
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(paidOrder));

        Showtime showtime = new Showtime();
        showtime.setMovieId(1L);
        showtime.setEndTime(LocalDateTime.now().minusHours(2)); // Already finished
        when(showtimeRepository.findById(10L)).thenReturn(Optional.of(showtime));

        ReviewEligibilityResponse eligibility = reviewService.getMovieEligibility(1L, 1L);

        assertTrue(eligibility.getEligible());
        assertTrue(eligibility.getHasPaidTicket());
        assertTrue(eligibility.getWatched());
        assertFalse(eligibility.getHasReviewed());
    }

    @Test
    void getMovieEligibility_WhenNotWatched_ReturnsFalse() {
        when(movieRepository.existsById(1L)).thenReturn(true);
        when(reviewRepository.existsByUserIdAndMovieId(1L, 1L)).thenReturn(false);

        Order paidOrder = new Order();
        paidOrder.setStatus(Order.OrderStatus.PAID);
        paidOrder.setShowtimeId(10L);
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(paidOrder));

        Showtime showtime = new Showtime();
        showtime.setMovieId(1L);
        showtime.setEndTime(LocalDateTime.now().plusHours(2)); // In the future
        when(showtimeRepository.findById(10L)).thenReturn(Optional.of(showtime));

        ReviewEligibilityResponse eligibility = reviewService.getMovieEligibility(1L, 1L);

        assertFalse(eligibility.getEligible());
        assertTrue(eligibility.getHasPaidTicket());
        assertFalse(eligibility.getWatched());
        assertEquals("REVIEW_REQUIRES_WATCHED_SHOWTIME", eligibility.getReasonCode());
    }

    @Test
    void getMovieEligibility_WhenNoPaidTicket_ReturnsFalse() {
        when(movieRepository.existsById(1L)).thenReturn(true);
        when(reviewRepository.existsByUserIdAndMovieId(1L, 1L)).thenReturn(false);

        Order unpaidOrder = new Order();
        unpaidOrder.setStatus(Order.OrderStatus.CANCELLED);
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(unpaidOrder));

        ReviewEligibilityResponse eligibility = reviewService.getMovieEligibility(1L, 1L);

        assertFalse(eligibility.getEligible());
        assertFalse(eligibility.getHasPaidTicket());
        assertEquals("REVIEW_REQUIRES_PAID_TICKET", eligibility.getReasonCode());
    }

    // --- getMovieInsight Tests ---

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
}
