package com.uit.cinema.analytics.service;

import com.uit.cinema.analytics.dto.DashboardOverviewResponse;
import com.uit.cinema.analytics.dto.LiveSaleResponse;
import com.uit.cinema.analytics.dto.PopularMovieResponse;
import com.uit.cinema.analytics.dto.RevenuePointResponse;

import java.time.LocalDate;
import java.util.List;

public interface DashboardAnalyticsService {
    DashboardOverviewResponse getOverview(LocalDate from, LocalDate to);

    List<RevenuePointResponse> getRevenueSeries(LocalDate from, LocalDate to, String bucket);

    List<LiveSaleResponse> getLiveSales(int limit);

    List<PopularMovieResponse> getPopularMovies(LocalDate from, LocalDate to, int limit);
}
