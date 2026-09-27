package com.uit.cinema.analytics.dto;

import java.math.BigDecimal;

public record RevenuePointResponse(
    String label,
    BigDecimal revenue,
    long orders,
    long tickets
) {
}
