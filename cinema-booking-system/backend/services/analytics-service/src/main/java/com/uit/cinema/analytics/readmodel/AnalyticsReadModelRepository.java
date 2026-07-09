package com.uit.cinema.analytics.readmodel;

import com.uit.cinema.analytics.dto.LiveSaleResponse;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public interface AnalyticsReadModelRepository {
    DashboardMetric dashboardMetric(LocalDateTime from, LocalDateTime to);

    Map<java.time.LocalDate, RevenueMetric> revenueByDay(LocalDateTime from, LocalDateTime to);

    List<LiveSaleResponse> liveSales(int limit);

    List<PopularMovieMetric> popularMovies(LocalDateTime from, LocalDateTime to, int limit);
}
