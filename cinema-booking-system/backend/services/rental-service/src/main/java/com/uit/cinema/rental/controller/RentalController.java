package com.uit.cinema.rental.controller;

import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.rental.entity.RentalStatus;
import com.uit.cinema.rental.security.RentalActorResolver;
import com.uit.cinema.rental.service.RentalModels;
import com.uit.cinema.rental.service.RentalService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/rentals")
public class RentalController {

    private final RentalService rentalService;
    private final RentalActorResolver actors;

    public RentalController(RentalService rentalService, RentalActorResolver actors) {
        this.rentalService = rentalService;
        this.actors = actors;
    }

    @PostMapping("/quote")
    public ResponseEntity<ApiResponse<RentalModels.Quote>> quote(@RequestBody RentalWindowRequest request) {
        return ResponseEntity.ok(ApiResponse.success(rentalService.quote(request.toWindow()), "Báo giá thuê phòng"));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<RentalModels.RentalView>> create(@RequestBody RentalCreateRequest request) {
        Long userId = actors.userId(request.userId());
        return ResponseEntity.ok(ApiResponse.success(rentalService.create(userId, request.toWindow()), "Đã gửi yêu cầu thuê"));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<List<RentalModels.RentalView>>> mine(@RequestParam(required = false) Long userId) {
        return ResponseEntity.ok(ApiResponse.success(rentalService.mine(actors.userId(userId)), "Đơn thuê của tôi"));
    }

    @GetMapping("/rooms/{roomId}/availability")
    public ResponseEntity<ApiResponse<RentalModels.Availability>> availability(
        @PathVariable Long roomId,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to
    ) {
        return ResponseEntity.ok(ApiResponse.success(rentalService.availability(roomId, from, to), "Lịch phòng"));
    }

    @GetMapping("/report")
    public ResponseEntity<ApiResponse<RentalModels.Report>> report(
        @RequestParam(required = false) Long userId,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to
    ) {
        return ResponseEntity.ok(ApiResponse.success(rentalService.report(actors.actor(userId), from, to), "Báo cáo thuê phòng"));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<RentalModels.RentalView>>> search(
        @RequestParam(required = false) Long userId,
        @RequestParam(required = false) Long cinemaId,
        @RequestParam(required = false) Long roomId,
        @RequestParam(required = false) RentalStatus status,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to
    ) {
        return ResponseEntity.ok(ApiResponse.success(
            rentalService.search(actors.actor(userId), cinemaId, roomId, status, from, to),
            "Danh sách đơn thuê"
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<RentalModels.RentalView>> get(
        @PathVariable Long id,
        @RequestParam(required = false) Long userId
    ) {
        return ResponseEntity.ok(ApiResponse.success(rentalService.get(id, actors.actor(userId)), "Chi tiết đơn thuê"));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<RentalModels.RentalView>> approve(
        @PathVariable Long id,
        @RequestParam(required = false) Long userId
    ) {
        return ResponseEntity.ok(ApiResponse.success(rentalService.approve(id, actors.actor(userId)), "Đã duyệt đơn thuê"));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<ApiResponse<RentalModels.RentalView>> reject(
        @PathVariable Long id,
        @RequestBody ReasonRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
            rentalService.reject(id, request.reason(), actors.actor(request.userId())),
            "Đã từ chối đơn thuê"
        ));
    }

    @PostMapping("/{id}/pay")
    public ResponseEntity<ApiResponse<RentalModels.RentalView>> pay(
        @PathVariable Long id,
        @RequestBody PaymentRequest request
    ) {
        RentalModels.RentalView paid = rentalService.pay(id, request.paymentMethod(), actors.actor(request.userId()));
        String message = paid.status() == RentalStatus.CONFIRMED
            ? "Đã xác nhận thanh toán"
            : "Đã ghi nhận thanh toán, chờ cổng thanh toán";
        return ResponseEntity.ok(ApiResponse.success(paid, message));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<RentalModels.RentalView>> cancel(
        @PathVariable Long id,
        @RequestParam(required = false) Long userId
    ) {
        return ResponseEntity.ok(ApiResponse.success(rentalService.cancel(id, actors.actor(userId)), "Đã hủy đơn thuê"));
    }

    @PostMapping("/{id}/refunds/complete")
    public ResponseEntity<ApiResponse<RentalModels.RentalView>> completeRefund(
        @PathVariable Long id,
        @RequestParam(required = false) Long userId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
            rentalService.completeRefund(id, actors.actor(userId)),
            "Đã hoàn tất hoàn tiền"
        ));
    }

    @PutMapping("/rates/{roomId}")
    public ResponseEntity<ApiResponse<RentalModels.Quote>> setRate(
        @PathVariable Long roomId,
        @RequestBody RateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
            rentalService.setRate(roomId, request.pricePerHour(), actors.actor(request.userId())),
            "Đã cập nhật giá thuê"
        ));
    }

    public record RentalWindowRequest(Long roomId, Long movieId, LocalDateTime startTime, LocalDateTime endTime) {
        RentalModels.Window toWindow() {
            return new RentalModels.Window(roomId, movieId, startTime, endTime);
        }
    }

    public record RentalCreateRequest(Long userId, Long roomId, Long movieId, LocalDateTime startTime, LocalDateTime endTime) {
        RentalModels.Window toWindow() {
            return new RentalModels.Window(roomId, movieId, startTime, endTime);
        }
    }

    public record ReasonRequest(Long userId, String reason) {
    }

    public record PaymentRequest(Long userId, String paymentMethod) {
    }

    public record RateRequest(Long userId, BigDecimal pricePerHour) {
    }
}
