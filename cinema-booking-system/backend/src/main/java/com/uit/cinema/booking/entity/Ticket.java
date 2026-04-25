package com.uit.cinema.booking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "tickets")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column(nullable = false)
    private Long showtimeSeatId;

    @Column(nullable = false, unique = true, length = 100)
    private String ticketCode;

    @Column(columnDefinition = "TEXT")
    private String qrCodeData;

    @Column(precision = 12, scale = 2, nullable = false)
    private BigDecimal price;

    @Column(length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TicketStatus status = TicketStatus.VALID;

    private LocalDateTime checkedInAt;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum TicketStatus {
        VALID, USED, CANCELLED
    }
}
