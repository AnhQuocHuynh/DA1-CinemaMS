package com.uit.cinema.facility.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "seat_templates",
       uniqueConstraints = @UniqueConstraint(columnNames = {"room_id", "row_label", "column_number"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class SeatTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seat_type_id")
    private SeatType seatType;

    @Column(nullable = false, length = 5)
    private String rowLabel;

    @Column(nullable = false)
    private Integer columnNumber;

    @Builder.Default
    private boolean active = true;
}
