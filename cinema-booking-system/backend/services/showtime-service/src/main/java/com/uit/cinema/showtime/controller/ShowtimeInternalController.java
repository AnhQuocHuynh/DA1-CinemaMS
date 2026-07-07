package com.uit.cinema.showtime.controller;

import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.showtime.service.SeatReservationService;
import com.uit.cinema.showtime.service.ShowtimeService;
import com.uit.cinema.showtime.service.contract.RoomShowtimeCheckRequest;
import com.uit.cinema.showtime.service.contract.SeatBookingRequest;
import com.uit.cinema.showtime.service.contract.SeatBookingResult;
import com.uit.cinema.showtime.service.contract.SeatHoldValidationResult;
import com.uit.cinema.showtime.service.contract.SeatReleaseRequest;
import com.uit.cinema.showtime.service.contract.ShowtimeScheduleView;
import com.uit.cinema.showtime.service.contract.ShowtimeSeatView;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/showtimes")
@RequiredArgsConstructor
public class ShowtimeInternalController {

    private final SeatReservationService seatReservationService;
    private final ShowtimeService showtimeService;

    @GetMapping("/rooms/{roomId}/future-exists")
    public ResponseEntity<ApiResponse<Boolean>> hasFutureShowtimesForRoom(@PathVariable Long roomId) {
        return ResponseEntity.ok(ApiResponse.success(showtimeService.hasFutureShowtimesForRoom(roomId)));
    }

    @PostMapping("/rooms/future-exists")
    public ResponseEntity<ApiResponse<Boolean>> hasFutureShowtimesForRooms(
        @RequestBody RoomShowtimeCheckRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(showtimeService.hasFutureShowtimesForRooms(request.roomIds())));
    }

    @GetMapping("/{showtimeId}/schedule")
    public ResponseEntity<ApiResponse<ShowtimeScheduleView>> getSchedule(@PathVariable Long showtimeId) {
        return ResponseEntity.ok(ApiResponse.success(seatReservationService.getSchedule(showtimeId)));
    }

    @GetMapping("/seats/{seatId}")
    public ResponseEntity<ApiResponse<ShowtimeSeatView>> getSeat(@PathVariable Long seatId) {
        return ResponseEntity.ok(ApiResponse.success(seatReservationService.findSeat(seatId).orElse(null)));
    }

    @PostMapping("/seats/validate-held")
    public ResponseEntity<ApiResponse<SeatHoldValidationResult>> validateHeldSeats(@RequestBody SeatBookingRequest request) {
        return ResponseEntity.ok(ApiResponse.success(seatReservationService.validateHeldSeats(request)));
    }

    @PostMapping("/seats/validate-available")
    public ResponseEntity<ApiResponse<SeatHoldValidationResult>> validateAvailableSeats(@RequestBody SeatBookingRequest request) {
        return ResponseEntity.ok(ApiResponse.success(seatReservationService.validateAvailableSeats(request)));
    }

    @PostMapping("/seats/confirm-held")
    public ResponseEntity<ApiResponse<SeatBookingResult>> confirmHeldSeats(@RequestBody SeatBookingRequest request) {
        return ResponseEntity.ok(ApiResponse.success(seatReservationService.confirmHeldSeats(request)));
    }

    @PostMapping("/seats/book-available")
    public ResponseEntity<ApiResponse<SeatBookingResult>> bookAvailableSeats(@RequestBody SeatBookingRequest request) {
        return ResponseEntity.ok(ApiResponse.success(seatReservationService.bookAvailableSeats(request)));
    }

    @PostMapping("/seats/release-held")
    public ResponseEntity<ApiResponse<Void>> releaseHeldSeats(@RequestBody SeatBookingRequest request) {
        seatReservationService.releaseHeldSeats(request);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/seats/release-booked")
    public ResponseEntity<ApiResponse<Void>> releaseBookedSeats(@RequestBody SeatReleaseRequest request) {
        seatReservationService.releaseBookedSeats(request);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
