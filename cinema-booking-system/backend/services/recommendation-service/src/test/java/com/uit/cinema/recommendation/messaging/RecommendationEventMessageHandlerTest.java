package com.uit.cinema.recommendation.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uit.cinema.recommendation.service.UserRatingService;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class RecommendationEventMessageHandlerTest {

    private final RecommendationEventProjectionStore projectionStore =
        mock(RecommendationEventProjectionStore.class);
    private final UserRatingService userRatingService = mock(UserRatingService.class);
    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    private RecommendationEventMessageHandler handler;

    @BeforeEach
    void setUp() {
        handler = new RecommendationEventMessageHandler(
            new ObjectMapper(),
            projectionStore,
            meterRegistry,
            userRatingService
        );
    }

    @Test
    void validCatalogEvent_isProjected() {
        when(projectionStore.project(any())).thenReturn(true);

        handler.consumeCatalogEvent(movieEvent("catalog-service", 1));

        verify(projectionStore).project(any());
        assertThat(counter("projected")).isEqualTo(1);
    }

    @Test
    void duplicateEvent_isMeasuredWithoutFailure() {
        when(projectionStore.project(any())).thenReturn(false);

        handler.consumeCatalogEvent(movieEvent("catalog-service", 1));

        assertThat(counter("duplicate")).isEqualTo(1);
    }

    @Test
    void wrongSource_isRejectedBeforeGraphMutation() {
        assertThatThrownBy(() -> handler.consumeCatalogEvent(movieEvent("booking-service", 1)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Unexpected event source");

        verifyNoInteractions(projectionStore);
        assertThat(counter("rejected")).isEqualTo(1);
    }

    @Test
    void unsupportedSchema_isRejectedBeforeGraphMutation() {
        assertThatThrownBy(() -> handler.consumeCatalogEvent(movieEvent("catalog-service", 2)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("schema version");

        verifyNoInteractions(projectionStore);
    }

    @Test
    void visibleMovieReviewCreated_syncsUserRating() {
        when(projectionStore.project(any())).thenReturn(true);

        handler.consumeBookingEvent(reviewEvent(50L, null, 5, "VISIBLE"));

        verify(userRatingService).upsert(5L, 50L, 5.0);
        assertThat(counter("projected")).isEqualTo(1);
    }

    @Test
    void eventOnlyReviewCreated_skipsUserRatingSync() {
        when(projectionStore.project(any())).thenReturn(true);

        handler.consumeBookingEvent(reviewEvent(null, 9L, 5, "VISIBLE"));

        verifyNoInteractions(userRatingService);
    }

    @Test
    void duplicateReviewCreated_skipsUserRatingSync() {
        when(projectionStore.project(any())).thenReturn(false);

        handler.consumeBookingEvent(reviewEvent(50L, null, 5, "VISIBLE"));

        verifyNoInteractions(userRatingService);
        assertThat(counter("duplicate")).isEqualTo(1);
    }

    private double counter(String outcome) {
        return meterRegistry.get("cinema.recommendation.events").tag("outcome", outcome).counter().count();
    }

    private String reviewEvent(Long movieId, Long eventId, int rating, String status) {
        return """
            {
              "eventId": "550e8400-e29b-41d4-a716-446655440021",
              "eventType": "review.created",
              "occurredAt": "2026-11-22T07:00:00Z",
              "schemaVersion": 1,
              "source": "booking-service",
              "payload": {
                "reviewId": 99,
                "userId": 5,
                "movieId": %s,
                "eventId": %s,
                "rating": %d,
                "status": "%s"
              }
            }
            """.formatted(
                movieId == null ? "null" : movieId,
                eventId == null ? "null" : eventId,
                rating,
                status
            );
    }

    private String movieEvent(String source, int schemaVersion) {
        return """
            {
              "eventId": "550e8400-e29b-41d4-a716-446655440020",
              "eventType": "movie.created",
              "occurredAt": "2026-07-10T12:00:00Z",
              "schemaVersion": %d,
              "source": "%s",
              "payload": {
                "movieId": 50,
                "title": "Projected movie",
                "active": true,
                "genreNames": ["Drama"]
              }
            }
            """.formatted(schemaVersion, source);
    }
}
