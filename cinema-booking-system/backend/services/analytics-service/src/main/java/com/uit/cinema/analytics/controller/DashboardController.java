package com.uit.cinema.analytics.controller;

import com.uit.cinema.analytics.dto.DashboardOverviewResponse;
import com.uit.cinema.analytics.dto.LiveSaleResponse;
import com.uit.cinema.analytics.dto.PopularMovieResponse;
import com.uit.cinema.analytics.dto.RevenuePointResponse;
import com.uit.cinema.analytics.service.DashboardAnalyticsService;
import com.uit.cinema.core.dto.response.ApiResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/admin/dashboard")
public class DashboardController {

    private final DashboardAnalyticsService dashboardAnalyticsService;

    public DashboardController(DashboardAnalyticsService dashboardAnalyticsService) {
        this.dashboardAnalyticsService = dashboardAnalyticsService;
    }

    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<DashboardOverviewResponse>> getOverview(
        @RequestParam(name = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(name = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(ApiResponse.success(
            dashboardAnalyticsService.getOverview(from, to),
            "Dashboard overview loaded"
        ));
    }

    @GetMapping("/revenue-series")
    public ResponseEntity<ApiResponse<List<RevenuePointResponse>>> getRevenueSeries(
        @RequestParam(name = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(name = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(name = "bucket", defaultValue = "day") String bucket
    ) {
        return ResponseEntity.ok(ApiResponse.success(
            dashboardAnalyticsService.getRevenueSeries(from, to, bucket),
            "Revenue series loaded"
        ));
    }

    @GetMapping("/live-sales")
    public ResponseEntity<ApiResponse<List<LiveSaleResponse>>> getLiveSales(
        @RequestParam(name = "limit", defaultValue = "5") int limit
    ) {
        return ResponseEntity.ok(ApiResponse.success(
            dashboardAnalyticsService.getLiveSales(limit),
            "Live sales loaded"
        ));
    }

    @GetMapping("/popular-movies")
    public ResponseEntity<ApiResponse<List<PopularMovieResponse>>> getPopularMovies(
        @RequestParam(name = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(name = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(name = "limit", defaultValue = "5") int limit
    ) {
        return ResponseEntity.ok(ApiResponse.success(
            dashboardAnalyticsService.getPopularMovies(from, to, limit),
            "Popular movies loaded"
        ));
    }
}
