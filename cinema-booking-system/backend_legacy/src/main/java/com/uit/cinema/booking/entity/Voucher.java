package com.uit.cinema.booking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "vouchers")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Voucher {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(length = 20)
    @Enumerated(EnumType.STRING)
    private DiscountType discountType;

    @Column(precision = 12, scale = 2)
    private BigDecimal discountValue;

    @Column(precision = 12, scale = 2)
    private BigDecimal maxDiscountAmount;

    private Integer usageLimit;

    @Builder.Default
    private Integer usedCount = 0;

    private LocalDateTime validFrom;
    private LocalDateTime validUntil;

    @Builder.Default
    private boolean active = true;

    public enum DiscountType {
        PERCENTAGE, FIXED_AMOUNT
    }
}
