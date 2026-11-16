package com.uit.cinema.chatbot.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UpstreamJsonTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void mapsMovieFieldsIntoADocument() throws Exception {
        var documents = UpstreamJson.movies(mapper.readTree("""
            {"data":[{"id":7,"title":"Inception","description":"Mo","aiSummary":"Giac mo","genres":["Khoa hoc"],"durationMinutes":148}]}
            """));
        assertEquals(1, documents.size());
        assertEquals("movie:7", documents.get(0).externalKey());
        assertTrue(documents.get(0).body().contains("Tiêu đề: Inception"));
        assertTrue(documents.get(0).body().contains("Mô tả: Mo"));
        assertTrue(documents.get(0).body().contains("Thời lượng: 148 phút"));
        assertFalse(documents.get(0).body().contains("Giac mo"));
        assertFalse(documents.get(0).body().contains("Đạo diễn"));
        assertTrue(documents.get(0).metadataJson().contains("\"movieId\":7"));
    }

    @Test
    void skipsInactiveMoviesBlankTitlesAndEventTimes() throws Exception {
        var movies = UpstreamJson.movies(mapper.readTree("""
            {"data":[{"id":1,"title":"Hidden","active":false,"description":"No"},{"id":2,"title":"  ","description":"No"},{"id":3,"title":"Shown","active":true,"description":"Yes"}]}
            """));
        assertEquals(1, movies.size());
        assertEquals("movie:3", movies.get(0).externalKey());
        var events = UpstreamJson.events(mapper.readTree("""
            {"data":[{"id":4,"name":"Showcase","description":"Gap go","venue":"UIT","startTime":"2026-11-16T20:00:00","endTime":"2026-11-16T22:00:00"}]}
            """));
        assertEquals(1, events.size());
        assertTrue(events.get(0).body().contains("Sự kiện: Showcase"));
        assertFalse(events.get(0).body().contains("2026"));
        assertFalse(events.get(0).body().contains("Bắt đầu"));
    }

    @Test
    void skipsCancelledShowtimes() throws Exception {
        var lines = UpstreamJson.showtimes(mapper.readTree("""
            {"data":[{"displayTitle":"Inception","startTime":"2026-11-16T20:00:00","cinemaName":"UIT","roomName":"1","status":"CANCELLED"},{"displayTitle":"Inception","startTime":"2026-11-16T22:00:00","cinemaName":"UIT","roomName":"2","status":"OPEN"}]}
            """));
        assertEquals(1, lines.size());
        assertTrue(lines.get(0).contains("22:00"));
    }
}
