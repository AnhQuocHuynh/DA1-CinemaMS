package com.uit.cinema.analytics.service;

import com.uit.cinema.analytics.dto.DashboardOverviewResponse;
import com.uit.cinema.analytics.dto.LiveSaleResponse;
import com.uit.cinema.analytics.dto.PopularMovieResponse;
import com.uit.cinema.analytics.dto.RevenuePointResponse;
import com.uit.cinema.analytics.readmodel.AnalyticsReadModelRepository;
import com.uit.cinema.analytics.readmodel.DashboardMetric;
import com.uit.cinema.analytics.readmodel.PopularMovieMetric;
import com.uit.cinema.analytics.readmodel.RevenueMetric;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class DefaultDashboardAnalyticsService implements DashboardAnalyticsService {

    private static final DateTimeFormatter DAY_LABEL_FORMATTER =
        DateTimeFormatter.ofPattern("MMM dd", Locale.ENGLISH);

    private final AnalyticsReadModelRepository readModelRepository;

    public DefaultDashboardAnalyticsService(AnalyticsReadModelRepository readModelRepository) {
        this.readModelRepository = readModelRepository;
    }

    @Override
    public DashboardOverviewResponse getOverview(LocalDate from, LocalDate to) {
        DateRange range = resolveRange(from, to);
        DateRange previousRange = previousRange(range);
        DashboardMetric current = readModelRepository.dashboardMetric(range.from().atStartOfDay(), exclusiveEnd(range));
        DashboardMetric previous = readModelRepository.dashboardMetric(previousRange.from().atStartOfDay(), exclusiveEnd(previousRange));
        long totalSeats = current.seatsSold() + current.seatsAvailable();
        int occupancyRate = totalSeats == 0 ? 0 : (int) Math.round(current.seatsSold() * 100.0 / totalSeats);

        return new DashboardOverviewResponse(
            current.totalRevenue(),
            formatRevenueChange(current.totalRevenue(), previous.totalRevenue()),
            occupancyRate,
            current.seatsSold(),
            current.seatsAvailable(),
            current.totalBookings(),
            current.activeUsers(),
            current.totalMovies()
        );
    }

    @Override
    public List<RevenuePointResponse> getRevenueSeries(LocalDate from, LocalDate to, String bucket) {
        DateRange range = resolveRange(from, to);
        Map<LocalDate, RevenueMetric> actual = readModelRepository.revenueByDay(range.from().atStartOfDay(), exclusiveEnd(range));
        Map<LocalDate, RevenuePointResponse> points = new LinkedHashMap<>();
        LocalDate cursor = range.from();
        while (!cursor.isAfter(range.to())) {
            RevenueMetric metric = actual.getOrDefault(cursor, RevenueMetric.empty());
            points.put(cursor, new RevenuePointResponse(
                cursor.format(DAY_LABEL_FORMATTER),
                metric.revenue(),
                metric.orders(),
                metric.tickets()
            ));
            cursor = cursor.plusDays(1);
        }
        return List.copyOf(points.values());
    }

    @Override
    public List<LiveSaleResponse> getLiveSales(int limit) {
        return readModelRepository.liveSales(normalizeLimit(limit, 5, 20));
    }

    @Override
    public List<PopularMovieResponse> getPopularMovies(LocalDate from, LocalDate to, int limit) {
        DateRange range = resolveRange(from, to);
        List<PopularMovieMetric> movies = readModelRepository.popularMovies(
            range.from().atStartOfDay(),
            exclusiveEnd(range),
            normalizeLimit(limit, 5, 20)
        );
        long topTickets = movies.stream()
            .mapToLong(PopularMovieMetric::ticketsSold)
            .max()
            .orElse(0L);
        return movies.stream()
            .map(movie -> new PopularMovieResponse(
                movie.id(),
                movie.title(),
                topTickets == 0 ? 0 : (int) Math.round(movie.ticketsSold() * 100.0 / topTickets),
                movie.ticketsSold(),
                movie.revenue()
            ))
            .toList();
    }

    private DateRange resolveRange(LocalDate from, LocalDate to) {
        LocalDate end = to != null ? to : LocalDate.now();
        LocalDate start = from != null ? from : end.minusDays(29);
        if (start.isAfter(end)) {
            return new DateRange(end, start);
        }
        return new DateRange(start, end);
    }

    private DateRange previousRange(DateRange range) {
        long days = range.from().datesUntil(range.to().plusDays(1)).count();
        LocalDate previousTo = range.from().minusDays(1);
        LocalDate previousFrom = previousTo.minusDays(days - 1);
        return new DateRange(previousFrom, previousTo);
    }

    private LocalDateTime exclusiveEnd(DateRange range) {
        return range.to().plusDays(1).atStartOfDay();
    }

    private int normalizeLimit(int requested, int defaultValue, int max) {
        if (requested <= 0) {
            return defaultValue;
        }
        return Math.min(requested, max);
    }

    private String formatRevenueChange(BigDecimal current, BigDecimal previous) {
        if (previous.compareTo(BigDecimal.ZERO) == 0) {
            return current.compareTo(BigDecimal.ZERO) > 0 ? "+100% vs previous period" : "0% vs previous period";
        }
        BigDecimal change = current.subtract(previous)
            .multiply(BigDecimal.valueOf(100))
            .divide(previous, 1, RoundingMode.HALF_UP);
        String prefix = change.compareTo(BigDecimal.ZERO) >= 0 ? "+" : "";
        return prefix + change + "% vs previous period";
    }

    private record DateRange(LocalDate from, LocalDate to) {
    }
}
