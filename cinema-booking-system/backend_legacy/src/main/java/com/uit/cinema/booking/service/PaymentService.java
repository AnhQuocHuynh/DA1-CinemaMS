package com.uit.cinema.booking.service;

import com.uit.cinema.booking.entity.Order;
public interface PaymentService {
    Order processPayment(Long orderId, String paymentMethod, String transactionId);
    Order refund(Long orderId, String reason);
}
