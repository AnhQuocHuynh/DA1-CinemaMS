package com.uit.cinema.facility.controller;

import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.facility.dto.request.CinemaRequest;
import com.uit.cinema.facility.dto.response.CinemaResponse;
import com.uit.cinema.facility.service.CinemaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cinemas")
@RequiredArgsConstructor
public class CinemaController {

    private final CinemaService cinemaService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<CinemaResponse>>> getAllCinemas() {
        List<CinemaResponse> cinemas = cinemaService.getAllActiveCinemas();
        return ResponseEntity.ok(ApiResponse.success(cinemas, "Lấy danh sách rạp thành công"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<CinemaResponse>> getCinemaById(@PathVariable Long id) {
        CinemaResponse cinema = cinemaService.getCinemaById(id);
        return ResponseEntity.ok(ApiResponse.success(cinema, "Lấy thông tin rạp thành công"));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CinemaResponse>> createCinema(@Valid @RequestBody CinemaRequest request) {
        CinemaResponse cinema = cinemaService.createCinema(request);
        return ResponseEntity.ok(ApiResponse.success(cinema, "Tạo rạp mới thành công"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CinemaResponse>> updateCinema(@PathVariable Long id, @Valid @RequestBody CinemaRequest request) {
        CinemaResponse cinema = cinemaService.updateCinema(id, request);
        return ResponseEntity.ok(ApiResponse.success(cinema, "Cập nhật rạp thành công"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteCinema(@PathVariable Long id) {
        cinemaService.deleteCinema(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Xóa rạp thành công"));
    }
}
