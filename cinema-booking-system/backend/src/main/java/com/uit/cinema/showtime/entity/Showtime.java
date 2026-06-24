package com.uit.cinema.showtime.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "showtimes")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Showtime {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long roomId;

    private Long movieId;

    private Long eventId;

    @Column(nullable = false)
    private LocalDateTime startTime;

    @Column(nullable = false)
    private LocalDateTime endTime;

    @Column(precision = 12, scale = 2, nullable = false)
    private BigDecimal basePrice;

    @Column(length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Status status = Status.SCHEDULED;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum Status {
        SCHEDULED, STARTED, ENDED, CANCELLED
    }
}
