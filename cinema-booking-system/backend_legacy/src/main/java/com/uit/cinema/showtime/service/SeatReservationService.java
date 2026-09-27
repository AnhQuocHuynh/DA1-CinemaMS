package com.uit.cinema.showtime.service;

import com.uit.cinema.showtime.service.contract.SeatBookingRequest;
import com.uit.cinema.showtime.service.contract.SeatBookingResult;
import com.uit.cinema.showtime.service.contract.SeatHoldValidationResult;
import com.uit.cinema.showtime.service.contract.SeatReleaseRequest;
import com.uit.cinema.showtime.service.contract.ShowtimeSeatView;
import com.uit.cinema.showtime.service.contract.ShowtimeScheduleView;

import java.util.Optional;

/**
 * Booking-facing boundary for seat reservation operations.
 *
 * This service should be the only entry point that booking module uses
 * to validate held seats and to confirm held seats as booked.
 *
 * Implementation notes:
 * - Keep all repository access inside showtime module.
 * - Validate seat ownership, status, and showtime consistency.
 * - Prefer atomic bulk update when confirming seats.
 */
public interface SeatReservationService {

    /**
     * Validate the seat list for booking before order is created.
     */
    SeatHoldValidationResult validateHeldSeats(SeatBookingRequest request);

    /**
     * Validate seats that staff can book directly without a Redis hold.
     */
    SeatHoldValidationResult validateAvailableSeats(SeatBookingRequest request);

    /**
     * Confirm seats as BOOKED in one logical operation.
     */
    SeatBookingResult confirmHeldSeats(SeatBookingRequest request);

    /**
     * Confirm currently AVAILABLE seats as BOOKED for staff/counter booking.
     */
    SeatBookingResult bookAvailableSeats(SeatBookingRequest request);

    /**
     * Optional compensating action if order flow fails after seat validation.
     */
    void releaseHeldSeats(SeatBookingRequest request);

    /**
     * Release booked seats after refund/cancellation.
     */
    void releaseBookedSeats(SeatReleaseRequest request);

    /**
     * Read the showtime schedule without exposing showtime entities to booking.
     */
    ShowtimeScheduleView getSchedule(Long showtimeId);

    /**
     * Read a nullable showtime schedule projection for read models.
     */
    Optional<ShowtimeScheduleView> findSchedule(Long showtimeId);

    /**
     * Read a nullable showtime-seat projection for read models.
     */
    Optional<ShowtimeSeatView> findSeat(Long seatId);
}
