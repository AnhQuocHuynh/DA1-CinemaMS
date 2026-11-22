package com.uit.cinema.booking.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "review_ai_summaries")
@Getter
@Setter
@NoArgsConstructor
public class ReviewAiSummary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "target_key", nullable = false, unique = true, length = 40)
    private String targetKey;

    @Column(name = "movie_id")
    private Long movieId;

    @Column(name = "event_id")
    private Long eventId;

    @Column(name = "source_fingerprint", nullable = false, length = 64)
    private String sourceFingerprint;

    @Column(nullable = false, length = 800)
    private String summary;

    @Column(length = 1000)
    private String keywords;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
