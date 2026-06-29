package com.uit.cinema.facility.controller;

import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.facility.dto.request.RoomRequest;
import com.uit.cinema.facility.dto.response.RoomResponse;
import com.uit.cinema.facility.service.RoomService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cinemas/{cinemaId}/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getRooms(@PathVariable Long cinemaId) {
        List<RoomResponse> rooms = roomService.getRoomsByCinema(cinemaId);
        return ResponseEntity.ok(ApiResponse.success(rooms, "Lấy danh sách phòng chiếu thành công"));
    }

    @GetMapping("/{roomId}")
    public ResponseEntity<ApiResponse<RoomResponse>> getRoomById(@PathVariable Long cinemaId, @PathVariable Long roomId) {
        RoomResponse room = roomService.getRoomById(roomId);
        return ResponseEntity.ok(ApiResponse.success(room, "Lấy thông tin phòng chiếu thành công"));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<RoomResponse>> createRoom(@PathVariable Long cinemaId, @Valid @RequestBody RoomRequest request) {
        // Có thể bổ sung check xem request.getCinemaId() có match với path variable cinemaId không, hoặc override lại ID.
        request.setCinemaId(cinemaId);
        RoomResponse room = roomService.createRoom(request);
        return ResponseEntity.ok(ApiResponse.success(room, "Tạo phòng chiếu mới thành công"));
    }

    @PutMapping("/{roomId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<RoomResponse>> updateRoom(@PathVariable Long cinemaId, @PathVariable Long roomId, @Valid @RequestBody RoomRequest request) {
        request.setCinemaId(cinemaId);
        RoomResponse room = roomService.updateRoom(roomId, request);
        return ResponseEntity.ok(ApiResponse.success(room, "Cập nhật phòng chiếu thành công"));
    }

    @DeleteMapping("/{roomId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteRoom(@PathVariable Long cinemaId, @PathVariable Long roomId) {
        roomService.deleteRoom(roomId);
        return ResponseEntity.ok(ApiResponse.success(null, "Xóa phòng chiếu thành công"));
    }

    @GetMapping("/{roomId}/seats")
    public ResponseEntity<ApiResponse<List<com.uit.cinema.facility.dto.response.SeatTemplateResponse>>> getSeatMap(@PathVariable Long cinemaId, @PathVariable Long roomId) {
        List<com.uit.cinema.facility.dto.response.SeatTemplateResponse> seats = roomService.getSeatMapByRoomId(roomId);
        return ResponseEntity.ok(ApiResponse.success(seats, "Lấy sơ đồ ghế thành công"));
    }

    @PutMapping("/{roomId}/seats")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> updateSeatMap(@PathVariable Long cinemaId, @PathVariable Long roomId, @Valid @RequestBody com.uit.cinema.facility.dto.request.SeatMapUpdateRequest request) {
        roomService.updateSeatMap(roomId, request);
        return ResponseEntity.ok(ApiResponse.success(null, "Cập nhật sơ đồ ghế thành công"));
    }
}
