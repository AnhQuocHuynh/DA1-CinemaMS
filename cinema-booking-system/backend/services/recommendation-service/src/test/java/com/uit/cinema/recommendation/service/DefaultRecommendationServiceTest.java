package com.uit.cinema.recommendation.service;

import com.uit.cinema.recommendation.dto.MovieRecommendation;
import com.uit.cinema.recommendation.graph.RecommendationGraphStore;
import com.uit.cinema.recommendation.graph.UserTasteProfile;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DefaultRecommendationServiceTest {

    private final RecommendationGraphStore graphStore = mock(RecommendationGraphStore.class);
    private final DefaultRecommendationService service = new DefaultRecommendationService(graphStore);

    @Test
    void personalizedResults_areReturnedWithoutFallback() {
        MovieRecommendation recommendation = recommendation(10L);
        when(graphStore.isAvailable()).thenReturn(true);
        when(graphStore.findForUser(42L, 10)).thenReturn(List.of(recommendation));

        var response = service.recommendForUser(42L, 10);

        assertThat(response.algorithm()).isEqualTo("HYBRID_GRAPH");
        assertThat(response.recommendations()).containsExactly(recommendation);
        assertThat(response.metadata().fallbackUsed()).isFalse();
    }

    @Test
    void missingPersonalization_fallsBackToPopular() {
        MovieRecommendation recommendation = recommendation(11L);
        when(graphStore.isAvailable()).thenReturn(true);
        when(graphStore.findForUser(42L, 10)).thenReturn(List.of());
        when(graphStore.findPopular(10)).thenReturn(List.of(recommendation));

        var response = service.recommendForUser(42L, 10);

        assertThat(response.algorithm()).isEqualTo("POPULARITY_FALLBACK");
        assertThat(response.metadata().fallbackUsed()).isTrue();
        assertThat(response.recommendations()).containsExactly(recommendation);
    }

    @Test
    void excessiveLimit_isClampedBeforeQuery() {
        when(graphStore.findPopular(100)).thenReturn(List.of());

        service.popularMovies(500);

        verify(graphStore).findPopular(100);
    }

    @Test
    void tasteProfile_usesGraphProjection() {
        when(graphStore.isAvailable()).thenReturn(true);
        when(graphStore.findTasteProfile(42L)).thenReturn(new UserTasteProfile(List.of("Drama"), 3));

        var response = service.tasteProfile(42L);

        assertThat(response.preferredGenres()).containsExactly("Drama");
        assertThat(response.watchedMovies()).isEqualTo(3);
        assertThat(response.fallbackUsed()).isFalse();
    }

    private MovieRecommendation recommendation(long movieId) {
        return new MovieRecommendation(
            movieId,
            "Movie " + movieId,
            null,
            BigDecimal.TEN,
            "PREFERRED_GENRES",
            List.of("Drama"),
            BigDecimal.valueOf(4.5),
            12
        );
    }
}
