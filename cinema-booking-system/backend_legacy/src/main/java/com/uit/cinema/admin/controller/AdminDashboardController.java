package com.uit.cinema.admin.controller;

import com.uit.cinema.admin.dto.response.AdminDashboardOverviewResponse;
import com.uit.cinema.admin.dto.response.AdminLiveSaleResponse;
import com.uit.cinema.admin.dto.response.AdminPopularMovieResponse;
import com.uit.cinema.admin.dto.response.AdminRevenuePointResponse;
import com.uit.cinema.admin.service.AdminDashboardService;
import com.uit.cinema.core.dto.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/admin/dashboard")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminDashboardController {

    private final AdminDashboardService adminDashboardService;

    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<AdminDashboardOverviewResponse>> getOverview(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(ApiResponse.success(
            adminDashboardService.getOverview(from, to),
            "Lay tong quan dashboard thanh cong"
        ));
    }

    @GetMapping("/revenue-series")
    public ResponseEntity<ApiResponse<List<AdminRevenuePointResponse>>> getRevenueSeries(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(defaultValue = "day") String bucket
    ) {
        return ResponseEntity.ok(ApiResponse.success(
            adminDashboardService.getRevenueSeries(from, to, bucket),
            "Lay bieu do doanh thu thanh cong"
        ));
    }

    @GetMapping("/live-sales")
    public ResponseEntity<ApiResponse<List<AdminLiveSaleResponse>>> getLiveSales(
        @RequestParam(defaultValue = "5") int limit
    ) {
        return ResponseEntity.ok(ApiResponse.success(
            adminDashboardService.getLiveSales(limit),
            "Lay giao dich moi thanh cong"
        ));
    }

    @GetMapping("/popular-movies")
    public ResponseEntity<ApiResponse<List<AdminPopularMovieResponse>>> getPopularMovies(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(defaultValue = "5") int limit
    ) {
        return ResponseEntity.ok(ApiResponse.success(
            adminDashboardService.getPopularMovies(from, to, limit),
            "Lay phim pho bien thanh cong"
        ));
    }
}
