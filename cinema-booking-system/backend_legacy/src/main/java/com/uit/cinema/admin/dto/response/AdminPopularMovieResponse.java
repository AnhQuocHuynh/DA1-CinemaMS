package com.uit.cinema.admin.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class AdminPopularMovieResponse {
    private String id;
    private String title;
    private Integer score;
    private Long ticketsSold;
    private BigDecimal revenue;
}
