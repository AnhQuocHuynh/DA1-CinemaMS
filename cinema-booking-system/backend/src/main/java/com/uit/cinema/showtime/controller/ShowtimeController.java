package com.uit.cinema.showtime.controller;

import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.showtime.dto.request.ShowtimeRequest;
import com.uit.cinema.showtime.dto.response.ShowtimeResponse;
import com.uit.cinema.showtime.dto.response.ShowtimeSeatResponse;
import com.uit.cinema.core.security.CustomUserDetails;
import com.uit.cinema.showtime.service.ShowtimeService;
import com.uit.cinema.showtime.service.SeatLockingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/showtimes")
@RequiredArgsConstructor
public class ShowtimeController {

    private final ShowtimeService showtimeService;
    private final SeatLockingService seatLockingService;

    @GetMapping("/movie/{movieId}")
    public ResponseEntity<ApiResponse<List<ShowtimeResponse>>> getShowtimesByMovie(@PathVariable Long movieId) {
        List<ShowtimeResponse> showtimes = showtimeService.getShowtimesByMovie(movieId);
        return ResponseEntity.ok(ApiResponse.success(showtimes, "Lấy danh sách suất chiếu thành công"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ShowtimeResponse>> getShowtimeById(@PathVariable Long id) {
        ShowtimeResponse showtime = showtimeService.getShowtimeById(id);
        return ResponseEntity.ok(ApiResponse.success(showtime, "Lấy thông tin suất chiếu thành công"));
    }

    @GetMapping("/{id}/seats")
    public ResponseEntity<ApiResponse<List<ShowtimeSeatResponse>>> getSeatMap(@PathVariable Long id) {
        List<ShowtimeSeatResponse> seats = showtimeService.getSeatMap(id);
        return ResponseEntity.ok(ApiResponse.success(seats, "Lấy sơ đồ ghế thành công"));
    }

    @PostMapping("/{id}/hold")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> holdSeats(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody java.util.Map<String, Object> request
    ) {
        Long userId = userDetails.getUser().getId();
        @SuppressWarnings("unchecked")
        List<Long> seatIds = ((List<Integer>) request.get("seatIds")).stream().map(Long::valueOf).toList();
        seatLockingService.holdSeats(id, seatIds, userId);
        return ResponseEntity.ok(ApiResponse.success(null, "Giữ ghế thành công"));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('STAFF')")
    public ResponseEntity<ApiResponse<ShowtimeResponse>> createShowtime(@Valid @RequestBody ShowtimeRequest request) {
        ShowtimeResponse showtime = showtimeService.createShowtime(request);
        return ResponseEntity.ok(ApiResponse.success(showtime, "Tạo suất chiếu thành công"));
    }
}
