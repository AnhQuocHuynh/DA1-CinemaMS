package com.uit.cinema.analytics.readmodel;

import java.math.BigDecimal;

public record PopularMovieMetric(
    String id,
    String title,
    long ticketsSold,
    BigDecimal revenue
) {
}
