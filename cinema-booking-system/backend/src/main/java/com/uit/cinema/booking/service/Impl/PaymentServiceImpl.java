package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.service.PaymentService;
import com.uit.cinema.core.exception.CustomException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentServiceImpl implements PaymentService {

    private final OrderRepository orderRepository;

    @Override
    @Transactional
    public Order processPayment(Long orderId, String paymentMethod, String transactionId) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new CustomException("Đơn hàng không tồn tại", HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND"));
        if (order.getStatus() != Order.OrderStatus.PENDING) {
            throw new CustomException("Đơn hàng không ở trạng thái chờ thanh toán", HttpStatus.BAD_REQUEST, "INVALID_ORDER_STATUS");
        }
        order.setPaymentMethod(paymentMethod);
        order.setPaymentTransactionId(transactionId);
        order.setStatus(Order.OrderStatus.PAID);
        log.info("Order {} paid via {} — txn: {}", orderId, paymentMethod, transactionId);
        return orderRepository.save(order);
    }

    @Override
    @Transactional
    public Order refund(Long orderId, String reason) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new CustomException("Đơn hàng không tồn tại", HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND"));
        if (order.getStatus() != Order.OrderStatus.PAID) {
            throw new CustomException("Chỉ có thể hoàn tiền đơn đã thanh toán", HttpStatus.BAD_REQUEST, "INVALID_ORDER_STATUS");
        }
        order.setStatus(Order.OrderStatus.REFUNDED);
        log.info("Order {} refunded. Reason: {}", orderId, reason);
        return orderRepository.save(order);
    }
}
