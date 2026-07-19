package com.uit.cinema.admin.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class AdminLiveSaleResponse {
    private String id;
    private String movieTitle;
    private String screen;
    private Integer tickets;
    private BigDecimal amount;
    private String posterUrl;
}
