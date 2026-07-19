package com.uit.cinema.showtime.service;

import com.uit.cinema.showtime.service.contract.SeatBookingRequest;
import com.uit.cinema.showtime.service.contract.SeatBookingResult;
import com.uit.cinema.showtime.service.contract.SeatHoldValidationResult;

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
     * Confirm seats as BOOKED in one logical operation.
     */
    SeatBookingResult confirmHeldSeats(SeatBookingRequest request);

    /**
     * Optional compensating action if order flow fails after seat validation.
     */
    void releaseHeldSeats(SeatBookingRequest request);
}
