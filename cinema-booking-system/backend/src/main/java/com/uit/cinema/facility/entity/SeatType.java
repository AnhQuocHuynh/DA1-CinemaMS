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

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String name;

    @Column(precision = 12, scale = 2)
    private BigDecimal priceMultiplier;

    @Column(columnDefinition = "TEXT")
    private String description;
}
