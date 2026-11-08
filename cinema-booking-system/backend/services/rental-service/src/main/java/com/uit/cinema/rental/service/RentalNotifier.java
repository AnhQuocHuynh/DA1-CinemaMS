package com.uit.cinema.rental.service;

public interface RentalNotifier {
    void statusChanged(Long userId, Long rentalId, String title, String body);
}
