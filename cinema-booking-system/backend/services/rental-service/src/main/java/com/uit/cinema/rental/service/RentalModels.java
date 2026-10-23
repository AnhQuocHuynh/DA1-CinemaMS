package com.uit.cinema.rental.service;

import com.uit.cinema.rental.entity.RefundStatus;
import com.uit.cinema.rental.entity.RentalStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class RentalModels {

    private RentalModels() {
    }

    public record Actor(Long userId, String realmRole, List<Long> cinemaIds) {
        public boolean admin() {
            return "ADMIN".equals(realmRole);
        }

        public boolean managerOf(Long cinemaId) {
            return "MANAGER".equals(realmRole) && cinemaIds != null && cinemaIds.contains(cinemaId);
        }

        public boolean staffOf(Long cinemaId) {
            return "STAFF".equals(realmRole) && cinemaIds != null && cinemaIds.contains(cinemaId);
        }
    }

    public record Window(Long roomId, Long movieId, LocalDateTime startTime, LocalDateTime endTime) {
    }

    public record Quote(Long roomId, Long cinemaId, String roomName, LocalDateTime startTime, LocalDateTime endTime,
                        BigDecimal pricePerHour, int billedHours, BigDecimal totalAmount, boolean available,
                        String unavailableCode) {
    }

    public record RentalView(Long id, Long userId, Long cinemaId, Long roomId, Long movieId, LocalDateTime startTime,
                             LocalDateTime endTime, BigDecimal pricePerHour, BigDecimal totalAmount, RentalStatus status,
                             String paymentMethod, String decisionReason, LocalDateTime expiresAt,
                             BigDecimal refundAmount, RefundStatus refundStatus) {
    }

    public record BusySlot(String source, LocalDateTime startTime, LocalDateTime endTime, String status) {
    }

    public record Availability(Long roomId, LocalDateTime from, LocalDateTime to, BigDecimal pricePerHour,
                               List<BusySlot> busy) {
    }

    public record Report(long rentalCount, BigDecimal confirmedRevenue, List<Bucket> byRoom, List<Bucket> byDay) {
    }

    public record Bucket(String key, long count, BigDecimal confirmedRevenue) {
    }
}
