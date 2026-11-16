package com.uit.cinema.chatbot.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.uit.cinema.chatbot.service.ShowtimeKnowledgeClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;

@Slf4j
@Component
public class HttpShowtimeKnowledgeClient implements ShowtimeKnowledgeClient {

    private final RestClient showtimeRestClient;

    public HttpShowtimeKnowledgeClient(@Qualifier("showtimeRestClient") RestClient showtimeRestClient) {
        this.showtimeRestClient = showtimeRestClient;
    }

    @Override
    public List<String> linesForMovie(long movieId) {
        return lines("/api/showtimes/movie/" + movieId);
    }

    @Override
    public List<String> linesForEvent(long eventId) {
        return lines("/api/showtimes/event/" + eventId);
    }

    private List<String> lines(String path) {
        try {
            JsonNode body = showtimeRestClient.get().uri(path).retrieve().body(JsonNode.class);
            return UpstreamJson.showtimes(body);
        } catch (RestClientException ex) {
            log.warn("Showtime read failed: {}", ex.getClass().getSimpleName());
            return List.of();
        }
    }
}
