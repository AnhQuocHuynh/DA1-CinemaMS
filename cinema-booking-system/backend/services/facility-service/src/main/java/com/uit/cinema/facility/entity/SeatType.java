package com.uit.cinema.facility.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "seat_types")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class SeatType {

    public enum SeatTypeCode {
        STANDARD,
        VIP,
        COUPLE
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(unique = true, length = 30)
    private SeatTypeCode code;

    @Column(nullable = false, unique = true, length = 50)
    private String name;

    @Column(length = 100)
    private String displayName;

    @Column(precision = 12, scale = 2)
    private BigDecimal priceMultiplier;

    @Builder.Default
    private Integer defaultColumnSpan = 1;

    @Column(columnDefinition = "TEXT")
    private String description;
}
