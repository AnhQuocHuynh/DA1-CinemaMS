package com.uit.cinema.analytics.dto;

import java.math.BigDecimal;

public record LiveSaleResponse(
    String id,
    String movieTitle,
    String screen,
    int tickets,
    BigDecimal amount,
    String posterUrl
) {
}
