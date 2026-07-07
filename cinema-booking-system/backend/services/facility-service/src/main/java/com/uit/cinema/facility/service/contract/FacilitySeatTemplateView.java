package com.uit.cinema.facility.service.contract;

import java.math.BigDecimal;

/**
 * Lightweight seat-template projection for booking/ticket read models.
 */
public record FacilitySeatTemplateView(
    Long seatTemplateId,
    String rowLabel,
    Integer columnNumber,
    String seatType,
    String seatTypeCode,
    String seatTypeName,
    Integer columnSpan,
    Boolean pathway,
    BigDecimal priceMultiplier
) {
    public FacilitySeatTemplateView(
        Long seatTemplateId,
        String rowLabel,
        Integer columnNumber,
        String seatType,
        String seatTypeCode,
        String seatTypeName,
        Integer columnSpan
    ) {
        this(seatTemplateId, rowLabel, columnNumber, seatType, seatTypeCode, seatTypeName, columnSpan, false, BigDecimal.ONE);
    }

    public String label() {
        return rowLabel != null && columnNumber != null ? rowLabel + columnNumber : String.valueOf(seatTemplateId);
    }

    public boolean isPathway() {
        return Boolean.TRUE.equals(pathway);
    }

    public BigDecimal effectivePriceMultiplier() {
        return priceMultiplier != null ? priceMultiplier : BigDecimal.ONE;
    }
}
