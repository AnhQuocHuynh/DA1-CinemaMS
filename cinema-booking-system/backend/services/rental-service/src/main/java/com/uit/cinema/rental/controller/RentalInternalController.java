package com.uit.cinema.rental.controller;

import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.rental.service.RentalModels;
import com.uit.cinema.rental.service.RentalService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/internal/rentals")
public class RentalInternalController {

    private final RentalService rentalService;

    public RentalInternalController(RentalService rentalService) {
        this.rentalService = rentalService;
    }

    @GetMapping("/rooms/{roomId}/overlaps")
    public ResponseEntity<ApiResponse<Boolean>> overlaps(
        @PathVariable Long roomId,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end
    ) {
        return ResponseEntity.ok(ApiResponse.success(rentalService.hasBlockingRental(roomId, start, end), "Kiểm tra trùng chỗ thuê"));
    }

    @PostMapping("/{id}/payment-outcome")
    public ResponseEntity<ApiResponse<RentalModels.RentalView>> paymentOutcome(
        @PathVariable Long id,
        @RequestBody PaymentOutcomeRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
            rentalService.applyPaymentOutcome(id, request.success(), request.paymentMethod()),
            "Đã ghi nhận kết quả thanh toán"
        ));
    }

    public record PaymentOutcomeRequest(boolean success, String paymentMethod) {
    }
}
