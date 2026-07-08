package com.uit.cinema.analytics.dto;

import java.math.BigDecimal;

public record PopularMovieResponse(
    String id,
    String title,
    int score,
    long ticketsSold,
    BigDecimal revenue
) {
}
