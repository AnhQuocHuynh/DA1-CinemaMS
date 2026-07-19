package com.uit.cinema.booking.repository;

import com.uit.cinema.booking.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    List<Order> findByUserIdOrderByCreatedAtDesc(Long userId);

    boolean existsByUserIdAndVoucherIdAndStatusIn(Long userId, Long voucherId, List<Order.OrderStatus> statuses);

    List<Order> findByStatus(Order.OrderStatus status);

    Optional<Order> findByPaymentTransactionId(String paymentTransactionId);
}
