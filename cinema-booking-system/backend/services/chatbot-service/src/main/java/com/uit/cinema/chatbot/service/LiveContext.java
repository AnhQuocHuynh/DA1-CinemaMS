package com.uit.cinema.chatbot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Component
public class LiveContext {

    private final ShowtimeKnowledgeClient showtimes;
    private final BookingKnowledgeClient bookings;
    private final RecommendationKnowledgeClient recommendations;
    private final ObjectMapper objectMapper;

    public LiveContext(
        ShowtimeKnowledgeClient showtimes,
        BookingKnowledgeClient bookings,
        RecommendationKnowledgeClient recommendations,
        ObjectMapper objectMapper
    ) {
        this.showtimes = showtimes;
        this.bookings = bookings;
        this.recommendations = recommendations;
        this.objectMapper = objectMapper;
    }

    public List<String> collect(String message, List<PassageHit> hits, boolean bookingLookupAllowed, long actorId) {
        List<String> facts = new ArrayList<>();
        Set<Long> movieIds = new LinkedHashSet<>();
        Set<Long> eventIds = new LinkedHashSet<>();
        for (PassageHit hit : hits) {
            JsonNode metadata = read(hit.metadata());
            if (metadata.path("movieId").canConvertToLong() && metadata.path("movieId").asLong() > 0) {
                movieIds.add(metadata.path("movieId").asLong());
            }
            if (metadata.path("eventId").canConvertToLong() && metadata.path("eventId").asLong() > 0) {
                eventIds.add(metadata.path("eventId").asLong());
            }
        }
        for (Long movieId : movieIds) {
            facts.addAll(showtimes.linesForMovie(movieId));
        }
        for (Long eventId : eventIds) {
            facts.addAll(showtimes.linesForEvent(eventId));
        }
        if (wantsRecommendation(message)) {
            facts.addAll(recommendations.popularLines());
        }
        if (bookingLookupAllowed && actorId > 0 && wantsOrders(message)) {
            facts.addAll(bookings.linesForUser(actorId));
        }
        return facts;
    }

    private JsonNode read(String metadata) {
        try {
            return objectMapper.readTree(metadata == null || metadata.isBlank() ? "{}" : metadata);
        } catch (Exception ex) {
            return objectMapper.createObjectNode();
        }
    }

    static boolean wantsRecommendation(String message) {
        String text = normalize(message);
        return text.contains("goi y") || text.contains("recommend") || text.contains("xem gi");
    }

    static boolean wantsOrders(String message) {
        String text = normalize(message);
        return text.contains("ve cua") || text.contains("don hang") || text.contains("ticket") || text.contains("order");
    }

    private static String normalize(String message) {
        String lower = message == null ? "" : message.toLowerCase(Locale.ROOT);
        return lower
            .replace('đ', 'd')
            .replaceAll("[áàảãạăắằẳẵặâấầẩẫậ]", "a")
            .replaceAll("[éèẻẽẹêếềểễệ]", "e")
            .replaceAll("[íìỉĩị]", "i")
            .replaceAll("[óòỏõọôốồổỗộơớờởỡợ]", "o")
            .replaceAll("[úùủũụưứừửữự]", "u")
            .replaceAll("[ýỳỷỹỵ]", "y");
    }
}
