package com.uit.cinema.booking.service.Impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uit.cinema.booking.config.CinemaAiProperties;
import com.uit.cinema.booking.entity.Review;
import com.uit.cinema.booking.entity.ReviewAiSummary;
import com.uit.cinema.booking.service.ReviewAiSummaryView;
import com.uit.cinema.booking.service.ReviewCommentSample;
import com.uit.cinema.booking.service.ReviewSummaryAgent;
import com.uit.cinema.booking.service.ReviewSummaryCache;
import com.uit.cinema.booking.service.ReviewSummaryDraft;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReviewSummaryServiceTest {

    @Mock
    private ReviewSummaryCache cache;
    @Mock
    private ReviewSummaryAgent agent;

    private CinemaAiProperties properties;
    private ReviewSummaryService service;

    @BeforeEach
    void setUp() {
        properties = new CinemaAiProperties();
        properties.setEnabled(true);
        properties.setApiKey("test-key");
        service = new ReviewSummaryService(cache, agent, properties, new ObjectMapper());
    }

    @Test
    void skipsWhenNoWrittenComment() {
        Review ratingOnly = new Review();
        ratingOnly.setId(1L);
        ratingOnly.setRating(5);

        ReviewAiSummaryView view = service.summarize(4L, null, List.of(ratingOnly));

        assertNull(view.summary());
        assertTrue(view.keywords().isEmpty());
        verifyNoInteractions(cache, agent);
    }

    @Test
    void returnsCachedSummaryWhenCommentsAreUnchanged() throws Exception {
        Review review = comment(8L, 4, "Âm thanh nhỏ.");
        List<ReviewCommentSample> samples = ReviewSummaryService.samples(List.of(review));
        ReviewAiSummary row = new ReviewAiSummary();
        row.setSourceFingerprint(ReviewSummaryService.fingerprint(samples));
        row.setSummary("Khán giả chê âm thanh nhỏ.");
        row.setKeywords("[\"âm thanh\"]");
        when(cache.find("movie:4")).thenReturn(Optional.of(row));

        ReviewAiSummaryView view = service.summarize(4L, null, List.of(review));

        assertEquals("Khán giả chê âm thanh nhỏ.", view.summary());
        assertEquals(List.of("âm thanh"), view.keywords());
        verify(agent, never()).summarize(any());
    }

    @Test
    void callsGeminiAndStoresAFreshSummary() {
        Review review = comment(8L, 2, "Ghế cứng.");
        when(cache.find("event:9")).thenReturn(Optional.empty());
        when(agent.summarize(any())).thenReturn(Optional.of(
            new ReviewSummaryDraft("Khán giả chê ghế cứng.", List.of("ghế cứng"))
        ));

        ReviewAiSummaryView view = service.summarize(null, 9L, List.of(review));

        assertEquals("Khán giả chê ghế cứng.", view.summary());
        ArgumentCaptor<ReviewAiSummary> saved = ArgumentCaptor.forClass(ReviewAiSummary.class);
        verify(cache).save(saved.capture());
        assertEquals("event:9", saved.getValue().getTargetKey());
        assertEquals(9L, saved.getValue().getEventId());
        assertNull(saved.getValue().getMovieId());
        assertTrue(saved.getValue().getKeywords().contains("ghế cứng"));
    }

    @Test
    void doesNotStoreWhenGeminiReturnsEmpty() {
        Review review = comment(8L, 5, "Diễn xuất tốt.");
        when(cache.find(anyString())).thenReturn(Optional.empty());
        when(agent.summarize(any())).thenReturn(Optional.empty());

        ReviewAiSummaryView view = service.summarize(4L, null, List.of(review));

        assertNull(view.summary());
        verify(cache, never()).save(any());
    }

    @Test
    void doesNotCallGeminiWhenDisabled() {
        properties.setEnabled(false);
        Review review = comment(8L, 5, "Diễn xuất tốt.");
        when(cache.find(anyString())).thenReturn(Optional.empty());

        ReviewAiSummaryView view = service.summarize(4L, null, List.of(review));

        assertNull(view.summary());
        verifyNoInteractions(agent);
        verify(cache, never()).save(any());
    }

    @Test
    void keepsTheSummaryWhenTheCacheWriteLosesARace() {
        Review review = comment(8L, 2, "Ghế cứng.");
        when(cache.find(anyString())).thenReturn(Optional.empty());
        when(agent.summarize(any())).thenReturn(Optional.of(
            new ReviewSummaryDraft("Khán giả chê ghế cứng.", List.of("ghế cứng"))
        ));
        doThrow(new DataIntegrityViolationException("duplicate")).when(cache).save(any());

        ReviewAiSummaryView view = service.summarize(4L, null, List.of(review));

        assertEquals("Khán giả chê ghế cứng.", view.summary());
    }

    @Test
    void sendsOnlyTheNewestWrittenComments() {
        List<Review> reviews = new ArrayList<>();
        for (int id = 31; id >= 1; id--) {
            reviews.add(comment((long) id, 4, "Bình luận " + id + " về âm thanh."));
        }
        when(cache.find(anyString())).thenReturn(Optional.empty());
        when(agent.summarize(any())).thenReturn(Optional.of(new ReviewSummaryDraft("Âm thanh.", List.of())));

        service.summarize(4L, null, reviews);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ReviewCommentSample>> sent = ArgumentCaptor.forClass(List.class);
        verify(agent).summarize(sent.capture());
        assertEquals(30, sent.getValue().size());
        assertEquals(31L, sent.getValue().get(0).reviewId());
        assertTrue(sent.getValue().stream().noneMatch(sample -> sample.reviewId() == 1L));
    }

    @Test
    void truncatesALongCommentBeforeSendingIt() {
        Review review = comment(8L, 3, "a".repeat(450));
        when(cache.find(anyString())).thenReturn(Optional.empty());
        when(agent.summarize(any())).thenReturn(Optional.of(new ReviewSummaryDraft("Tóm tắt.", List.of())));

        service.summarize(4L, null, List.of(review));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ReviewCommentSample>> sent = ArgumentCaptor.forClass(List.class);
        verify(agent).summarize(sent.capture());
        assertEquals(400, sent.getValue().get(0).comment().length());
    }

    private static Review comment(Long id, int rating, String text) {
        Review review = new Review();
        review.setId(id);
        review.setRating(rating);
        review.setComment(text);
        return review;
    }
}
