package com.uit.cinema.showtime.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "showtime_seats",
       uniqueConstraints = @UniqueConstraint(columnNames = {"showtime_id", "seat_template_id"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ShowtimeSeat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long showtimeId;

    @Column(nullable = false)
    private Long seatTemplateId;

    @Column(precision = 12, scale = 2, nullable = false)
    private BigDecimal price;

    @Column(length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private SeatStatus status = SeatStatus.AVAILABLE;

    @Column(name = "held_by_user_id")
    private Long heldByUserId;

    @Column(name = "hold_expires_at")
    private Instant holdExpiresAt;

    public enum SeatStatus {
        AVAILABLE, HELD, BOOKED
    }
}
