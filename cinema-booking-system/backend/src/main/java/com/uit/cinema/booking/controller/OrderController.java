package com.uit.cinema.booking.controller;

import com.uit.cinema.booking.entity.Order;
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

    @PostMapping
    public ResponseEntity<Order> createOrder(@RequestBody Map<String, Object> request) {
        Long userId = Long.valueOf(request.get("userId").toString());
        Long showtimeId = Long.valueOf(request.get("showtimeId").toString());
        @SuppressWarnings("unchecked")
        List<Long> seatIds = ((List<Integer>) request.get("seatIds")).stream().map(Long::valueOf).toList();
        String voucherCode = (String) request.get("voucherCode");
        return ResponseEntity.ok(orderService.createOrder(userId, showtimeId, seatIds, voucherCode));
    }

    @PostMapping("/{id}/pay")
    public ResponseEntity<Order> payOrder(@PathVariable Long id, @RequestBody Map<String, String> request) {
        return ResponseEntity.ok(
            paymentService.processPayment(id, request.get("paymentMethod"), request.get("transactionId"))
        );
    }

    @PostMapping("/{id}/refund")
    public ResponseEntity<Order> refundOrder(@PathVariable Long id, @RequestBody Map<String, String> request) {
        return ResponseEntity.ok(paymentService.refund(id, request.get("reason")));
    }
}
