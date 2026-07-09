package com.uit.cinema.analytics.readmodel;

import com.uit.cinema.analytics.dto.LiveSaleResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Repository
@ConditionalOnProperty(name = "analytics.read-model.enabled", havingValue = "false", matchIfMissing = true)
public class EmptyAnalyticsReadModelRepository implements AnalyticsReadModelRepository {

    @Override
    public DashboardMetric dashboardMetric(LocalDateTime from, LocalDateTime to) {
        return DashboardMetric.empty();
    }

    @Override
    public Map<java.time.LocalDate, RevenueMetric> revenueByDay(LocalDateTime from, LocalDateTime to) {
        return Map.of();
    }

    @Override
    public List<LiveSaleResponse> liveSales(int limit) {
        return List.of();
    }

    @Override
    public List<PopularMovieMetric> popularMovies(LocalDateTime from, LocalDateTime to, int limit) {
        return List.of();
    }
}
