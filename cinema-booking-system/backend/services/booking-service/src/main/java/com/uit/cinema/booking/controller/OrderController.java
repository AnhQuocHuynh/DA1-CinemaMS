package com.uit.cinema.booking.controller;

import com.uit.cinema.booking.dto.response.OrderResponse;
import com.uit.cinema.booking.mapper.OrderResponseMapper;
import com.uit.cinema.booking.security.AuthenticatedUserIdResolver;
import com.uit.cinema.booking.security.BookingAuthorizationService;
import com.uit.cinema.booking.service.OrderService;
import com.uit.cinema.booking.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final PaymentService paymentService;
    private final OrderResponseMapper orderResponseMapper;
    private final AuthenticatedUserIdResolver userIdResolver;
    private final BookingAuthorizationService authorizationService;

    @PostMapping
    public ResponseEntity<OrderResponse> createOrder(@RequestBody Map<String, Object> request) {
        Long requestedUserId = request.get("userId") == null ? null : Long.valueOf(request.get("userId").toString());
        Long userId = userIdResolver.resolveSelf(requestedUserId);
        Long showtimeId = Long.valueOf(request.get("showtimeId").toString());
        List<Long> seatIds = parseSeatIds(request.get("seatIds"));
        String voucherCode = (String) request.get("voucherCode");
        return ResponseEntity.ok(orderResponseMapper.toResponse(orderService.createOrder(userId, showtimeId, seatIds, voucherCode)));
    }

    @PostMapping("/{id}/pay")
    public ResponseEntity<OrderResponse> payOrder(@PathVariable Long id, @RequestBody Map<String, String> request) {
        authorizationService.requireOrderAccess(id);
        return ResponseEntity.ok(
            orderResponseMapper.toResponse(paymentService.processPayment(id, request.get("paymentMethod"), request.get("transactionId")))
        );
    }

    @PostMapping("/{id}/refund")
    public ResponseEntity<OrderResponse> refundOrder(@PathVariable Long id, @RequestBody Map<String, String> request) {
        authorizationService.requireOrderAccess(id);
        return ResponseEntity.ok(orderResponseMapper.toResponse(paymentService.refund(id, request.get("reason"))));
    }

    private List<Long> parseSeatIds(Object rawSeatIds) {
        if (!(rawSeatIds instanceof List<?> values)) {
            return List.of();
        }
        return values.stream()
            .map(value -> Long.valueOf(value.toString()))
            .toList();
    }
}
