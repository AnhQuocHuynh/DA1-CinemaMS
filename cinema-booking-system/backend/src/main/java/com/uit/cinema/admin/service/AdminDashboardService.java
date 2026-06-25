package com.uit.cinema.admin.service;

import com.uit.cinema.admin.dto.response.AdminDashboardOverviewResponse;
import com.uit.cinema.admin.dto.response.AdminLiveSaleResponse;
import com.uit.cinema.admin.dto.response.AdminPopularMovieResponse;
import com.uit.cinema.admin.dto.response.AdminRevenuePointResponse;

import java.time.LocalDate;
import java.util.List;

public interface AdminDashboardService {
    AdminDashboardOverviewResponse getOverview(LocalDate from, LocalDate to);
    List<AdminRevenuePointResponse> getRevenueSeries(LocalDate from, LocalDate to, String bucket);
    List<AdminLiveSaleResponse> getLiveSales(int limit);
    List<AdminPopularMovieResponse> getPopularMovies(LocalDate from, LocalDate to, int limit);
}
