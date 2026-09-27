package com.uit.cinema.showtime.controller;

import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.showtime.dto.request.ShowtimeRequest;
import com.uit.cinema.showtime.dto.response.ShowtimeResponse;
import com.uit.cinema.showtime.dto.response.ShowtimeSeatResponse;
import com.uit.cinema.showtime.security.AuthenticatedUserIdResolver;
import com.uit.cinema.showtime.service.SeatLockingService;
import com.uit.cinema.showtime.service.ShowtimeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/showtimes")
@RequiredArgsConstructor
public class ShowtimeController {

    private final ShowtimeService showtimeService;
    private final SeatLockingService seatLockingService;
    private final AuthenticatedUserIdResolver userIdResolver;

    @GetMapping("/movie/{movieId}")
    public ResponseEntity<ApiResponse<List<ShowtimeResponse>>> getShowtimesByMovie(@PathVariable Long movieId) {
        List<ShowtimeResponse> showtimes = showtimeService.getShowtimesByMovie(movieId);
        return ResponseEntity.ok(ApiResponse.success(showtimes, "Fetched movie showtimes successfully"));
    }

    @GetMapping("/event/{eventId}")
    public ResponseEntity<ApiResponse<List<ShowtimeResponse>>> getShowtimesByEvent(@PathVariable Long eventId) {
        List<ShowtimeResponse> showtimes = showtimeService.getShowtimesByEvent(eventId);
        return ResponseEntity.ok(ApiResponse.success(showtimes, "Fetched event showtimes successfully"));
    }

    @GetMapping("/room/{roomId}")
    public ResponseEntity<ApiResponse<List<ShowtimeResponse>>> getShowtimesByRoom(@PathVariable Long roomId) {
        List<ShowtimeResponse> showtimes = showtimeService.getShowtimesByRoom(roomId);
        return ResponseEntity.ok(ApiResponse.success(showtimes, "Lấy danh sách suất chiếu thành công"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ShowtimeResponse>> getShowtimeById(@PathVariable Long id) {
        ShowtimeResponse showtime = showtimeService.getShowtimeById(id);
        return ResponseEntity.ok(ApiResponse.success(showtime, "Fetched showtime successfully"));
    }

    @GetMapping("/{id}/seats")
    public ResponseEntity<ApiResponse<List<ShowtimeSeatResponse>>> getSeatMap(@PathVariable Long id) {
        List<ShowtimeSeatResponse> seats = showtimeService.getSeatMap(id);
        return ResponseEntity.ok(ApiResponse.success(seats, "Fetched seat map successfully"));
    }

    @PostMapping("/{id}/hold")
    public ResponseEntity<ApiResponse<Void>> holdSeats(
            @PathVariable Long id,
            @RequestHeader(name = "X-User-Id", required = false) Long requestedUserId,
            @RequestBody java.util.Map<String, Object> request
    ) {
        @SuppressWarnings("unchecked")
        List<Long> seatIds = ((List<Integer>) request.get("seatIds")).stream().map(Long::valueOf).toList();
        Long userId = userIdResolver.resolveSelf(requestedUserId);
        seatLockingService.holdSeats(id, seatIds, userId);
        return ResponseEntity.ok(ApiResponse.success(null, "Seats held successfully"));
    }

    @DeleteMapping("/{id}/hold")
    public ResponseEntity<ApiResponse<Void>> releaseHeldSeats(
            @PathVariable Long id,
            @RequestHeader(name = "X-User-Id", required = false) Long requestedUserId,
            @RequestBody java.util.Map<String, Object> request
    ) {
        @SuppressWarnings("unchecked")
        List<Long> seatIds = ((List<Integer>) request.get("seatIds")).stream().map(Long::valueOf).toList();
        if (userIdResolver.isJwtEnabled()) {
            Long userId = userIdResolver.resolveSelf(requestedUserId);
            for (Long seatId : seatIds) {
                seatLockingService.releaseHold(id, seatId, userId);
            }
        } else {
            for (Long seatId : seatIds) {
                seatLockingService.releaseHold(id, seatId);
            }
        }
        return ResponseEntity.ok(ApiResponse.success(null, "Seat holds released successfully"));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('STAFF')")
    public ResponseEntity<ApiResponse<ShowtimeResponse>> createShowtime(@Valid @RequestBody ShowtimeRequest request) {
        ShowtimeResponse showtime = showtimeService.createShowtime(request);
        return ResponseEntity.ok(ApiResponse.success(showtime, "Showtime created successfully"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteShowtime(@PathVariable Long id) {
        showtimeService.deleteShowtime(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Xóa suất chiếu thành công"));
    }
}
