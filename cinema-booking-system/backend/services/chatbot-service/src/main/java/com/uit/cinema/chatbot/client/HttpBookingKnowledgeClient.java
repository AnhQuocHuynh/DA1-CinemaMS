package com.uit.cinema.chatbot.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.uit.cinema.chatbot.service.BookingKnowledgeClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;

@Slf4j
@Component
public class HttpBookingKnowledgeClient implements BookingKnowledgeClient {

    private final RestClient bookingRestClient;

    public HttpBookingKnowledgeClient(@Qualifier("bookingRestClient") RestClient bookingRestClient) {
        this.bookingRestClient = bookingRestClient;
    }

    @Override
    public List<String> linesForUser(long userId) {
        try {
            JsonNode body = bookingRestClient.get()
                .uri("/api/orders/users/{userId}", userId)
                .retrieve()
                .body(JsonNode.class);
            return UpstreamJson.orders(body);
        } catch (RestClientException ex) {
            log.warn("Booking read failed: {}", ex.getClass().getSimpleName());
            return List.of();
        }
    }
}
