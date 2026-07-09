package com.uit.cinema.analytics.readmodel;

import java.math.BigDecimal;

public record RevenueMetric(
    BigDecimal revenue,
    long orders,
    long tickets
) {

    public static RevenueMetric empty() {
        return new RevenueMetric(BigDecimal.ZERO, 0, 0);
    }
}
