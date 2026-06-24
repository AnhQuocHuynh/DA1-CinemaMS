package com.uit.cinema.admin.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class AdminRevenuePointResponse {
    private String label;
    private BigDecimal revenue;
    private Long orders;
    private Long tickets;
}
