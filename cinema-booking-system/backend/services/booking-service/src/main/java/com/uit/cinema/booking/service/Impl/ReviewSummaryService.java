package com.uit.cinema.booking.service.Impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uit.cinema.booking.config.CinemaAiProperties;
import com.uit.cinema.booking.entity.Review;
import com.uit.cinema.booking.entity.ReviewAiSummary;
import com.uit.cinema.booking.service.ReviewAiSummaryView;
import com.uit.cinema.booking.service.ReviewCommentSample;
import com.uit.cinema.booking.service.ReviewSummaryAgent;
import com.uit.cinema.booking.service.ReviewSummaryCache;
import com.uit.cinema.booking.service.ReviewSummaryDraft;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewSummaryService {

    static final int MAX_COMMENTS = 30;
    static final int MAX_COMMENT_CHARS = 400;

    private static final TypeReference<List<String>> KEYWORD_LIST = new TypeReference<>() {
    };

    private final ReviewSummaryCache cache;
    private final ReviewSummaryAgent agent;
    private final CinemaAiProperties properties;
    private final ObjectMapper objectMapper;

    public ReviewAiSummaryView summarize(Long movieId, Long eventId, List<Review> reviews) {
        List<ReviewCommentSample> samples = samples(reviews);
        if (samples.isEmpty()) {
            return ReviewAiSummaryView.empty();
        }
        String targetKey = targetKey(movieId, eventId);
        String fingerprint = fingerprint(samples);
        Optional<ReviewAiSummary> cached = cache.find(targetKey);
        if (cached.isPresent() && fingerprint.equals(cached.get().getSourceFingerprint())) {
            return toView(cached.get());
        }
        if (!properties.isEnabled() || properties.getApiKey() == null || properties.getApiKey().isBlank()) {
            return ReviewAiSummaryView.empty();
        }
        Optional<ReviewSummaryDraft> generated = agent.summarize(samples);
        if (generated.isEmpty()) {
            return ReviewAiSummaryView.empty();
        }
        persist(cached.orElseGet(ReviewAiSummary::new), targetKey, movieId, eventId, fingerprint, generated.get());
        return new ReviewAiSummaryView(generated.get().summary(), generated.get().keywords());
    }

    static List<ReviewCommentSample> samples(List<Review> reviews) {
        if (reviews == null || reviews.isEmpty()) {
            return List.of();
        }
        List<ReviewCommentSample> samples = new ArrayList<>();
        for (Review review : reviews) {
            if (review.getComment() == null || review.getComment().isBlank() || review.getRating() == null) {
                continue;
            }
            String text = review.getComment().strip();
            if (text.length() > MAX_COMMENT_CHARS) {
                text = text.substring(0, MAX_COMMENT_CHARS);
            }
            long id = review.getId() == null ? 0L : review.getId();
            samples.add(new ReviewCommentSample(id, review.getRating(), text));
            if (samples.size() == MAX_COMMENTS) {
                break;
            }
        }
        return List.copyOf(samples);
    }

    static String targetKey(Long movieId, Long eventId) {
        if (movieId != null) {
            return "movie:" + movieId;
        }
        if (eventId != null) {
            return "event:" + eventId;
        }
        throw new IllegalArgumentException("Review summary requires a movie or an event");
    }

    static String fingerprint(List<ReviewCommentSample> samples) {
        String canonical = samples.stream()
            .sorted((left, right) -> Long.compare(left.reviewId(), right.reviewId()))
            .map(sample -> sample.reviewId() + "|" + sample.rating() + "|" + sample.comment())
            .reduce((left, right) -> left + "\n" + right)
            .orElse("");
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    private void persist(
        ReviewAiSummary row,
        String targetKey,
        Long movieId,
        Long eventId,
        String fingerprint,
        ReviewSummaryDraft draft
    ) {
        row.setTargetKey(targetKey);
        row.setMovieId(movieId);
        row.setEventId(eventId);
        row.setSourceFingerprint(fingerprint);
        row.setSummary(draft.summary());
        row.setKeywords(writeKeywords(draft.keywords()));
        row.setUpdatedAt(LocalDateTime.now());
        try {
            cache.save(row);
        } catch (DataAccessException ex) {
            log.warn("Could not store review summary for {}: {}", targetKey, ex.getClass().getSimpleName());
        }
    }

    private ReviewAiSummaryView toView(ReviewAiSummary row) {
        return new ReviewAiSummaryView(row.getSummary(), readKeywords(row.getKeywords()));
    }

    private String writeKeywords(List<String> keywords) {
        try {
            return objectMapper.writeValueAsString(keywords == null ? List.of() : keywords);
        } catch (JsonProcessingException ex) {
            return "[]";
        }
    }

    private List<String> readKeywords(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<String> keywords = objectMapper.readValue(json, KEYWORD_LIST);
            return keywords == null ? List.of() : List.copyOf(keywords);
        } catch (JsonProcessingException ex) {
            log.warn("Stored review keywords were not valid JSON");
            return List.of();
        }
    }
}
