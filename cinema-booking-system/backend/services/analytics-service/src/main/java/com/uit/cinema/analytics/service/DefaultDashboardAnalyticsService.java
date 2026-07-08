package com.uit.cinema.analytics.service;

import com.uit.cinema.analytics.dto.DashboardOverviewResponse;
import com.uit.cinema.analytics.dto.LiveSaleResponse;
import com.uit.cinema.analytics.dto.PopularMovieResponse;
import com.uit.cinema.analytics.dto.RevenuePointResponse;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class DefaultDashboardAnalyticsService implements DashboardAnalyticsService {

    private static final DateTimeFormatter DAY_LABEL_FORMATTER =
        DateTimeFormatter.ofPattern("MMM dd", Locale.ENGLISH);

    @Override
    public DashboardOverviewResponse getOverview(LocalDate from, LocalDate to) {
        return new DashboardOverviewResponse(
            BigDecimal.ZERO,
            "0% vs previous period",
            0,
            0,
            0,
            0,
            0,
            0
        );
    }

    @Override
    public List<RevenuePointResponse> getRevenueSeries(LocalDate from, LocalDate to, String bucket) {
        DateRange range = resolveRange(from, to);
        Map<LocalDate, RevenuePointResponse> points = new LinkedHashMap<>();
        LocalDate cursor = range.from();
        while (!cursor.isAfter(range.to())) {
            points.put(cursor, new RevenuePointResponse(cursor.format(DAY_LABEL_FORMATTER), BigDecimal.ZERO, 0, 0));
            cursor = cursor.plusDays(1);
        }
        return List.copyOf(points.values());
    }

    @Override
    public List<LiveSaleResponse> getLiveSales(int limit) {
        return List.of();
    }

    @Override
    public List<PopularMovieResponse> getPopularMovies(LocalDate from, LocalDate to, int limit) {
        return List.of();
    }

    private DateRange resolveRange(LocalDate from, LocalDate to) {
        LocalDate end = to != null ? to : LocalDate.now();
        LocalDate start = from != null ? from : end.minusDays(29);
        if (start.isAfter(end)) {
            return new DateRange(end, start);
        }
        return new DateRange(start, end);
    }

    private record DateRange(LocalDate from, LocalDate to) {
    }
}
