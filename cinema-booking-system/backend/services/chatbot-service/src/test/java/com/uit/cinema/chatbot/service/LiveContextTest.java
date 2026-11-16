package com.uit.cinema.chatbot.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LiveContextTest {

    private final ShowtimeKnowledgeClient showtimes = mock(ShowtimeKnowledgeClient.class);
    private final BookingKnowledgeClient bookings = mock(BookingKnowledgeClient.class);
    private final RecommendationKnowledgeClient recommendations = mock(RecommendationKnowledgeClient.class);
    private final LiveContext context = new LiveContext(showtimes, bookings, recommendations, new ObjectMapper());

    @Test
    void skipsBookingUnlessLookupIsAllowed() {
        context.collect("Vé của tôi đâu", List.of(), false, 5);
        verify(bookings, never()).linesForUser(5);

        context.collect("Vé của tôi đâu", List.of(), true, 5);
        verify(bookings).linesForUser(5);
    }

    @Test
    void loadsShowtimesForRetrievedMovies() {
        when(showtimes.linesForMovie(9)).thenReturn(List.of("Suất tối"));
        PassageHit hit = new PassageHit(UUID.randomUUID(), UUID.randomUUID(), "Inception", "movie/9", "text",
            "{\"movieId\":9,\"title\":\"Inception\"}", 0.1);
        List<String> facts = context.collect("phim này chiếu lúc nào", List.of(hit), false, 0);
        verify(showtimes).linesForMovie(9);
        org.junit.jupiter.api.Assertions.assertEquals(List.of("Suất tối"), facts);
    }
}
