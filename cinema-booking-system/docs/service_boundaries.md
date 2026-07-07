# Service Boundary Preparation

Status: migration-prep inside `backend_legacy` plus physical extraction of Catalog, Facility, and Showtime under `backend/`.

## Goal

Keep the modular monolith runnable while removing the highest-risk direct dependencies that would become distributed transaction bugs during a later service split.

## Current Boundary Rules

- Booking/payment/staff must not update showtime seats directly.
- Booking/payment/staff must not know Redis seat-hold keys.
- Showtime owns seat state transitions:
  - `AVAILABLE -> HELD`
  - `HELD -> BOOKED`
  - `HELD -> AVAILABLE`
  - `BOOKED -> AVAILABLE`
- Booking owns order/payment/ticket lifecycle.
- Catalog and facility expose read projections for booking/ticket response assembly.
- Showtime reads catalog/facility data through read projections rather than direct repositories/entities.
- Facility asks a showtime guard before destructive room/cinema deletes.
- Admin/staff dashboard services are read aggregations in the monolith for now; when services are split, move them to API aggregation or event-driven read models.

## Local Boundary Interfaces

### Booking -> Showtime

Interface: `SeatReservationService`

Contracts:

- `SeatBookingRequest`
- `SeatHoldValidationResult`
- `SeatBookingResult`
- `SeatReleaseRequest`
- `SeatView`
- `ShowtimeScheduleView`
- `ShowtimeSeatView`

Operations:

- `validateHeldSeats`: order creation validates HELD seats and Redis hold owner.
- `confirmHeldSeats`: payment confirms HELD seats as BOOKED and deletes Redis hold keys.
- `validateAvailableSeats`: staff booking validates directly bookable seats.
- `bookAvailableSeats`: staff booking confirms AVAILABLE seats as BOOKED.
- `releaseHeldSeats`: compensation for held seats.
- `releaseBookedSeats`: refund/cancel releases booked seats.
- `getSchedule` / `findSchedule`: booking-side policy checks without exposing showtime entities.
- `findSeat`: read projection for ticket/order response assembly.

### Booking -> Catalog

Interface: `CatalogReadService`

Operations:

- `findMovie`
- `findEvent`
- `movieExists`
- `eventExists`

### Booking -> Facility

Interface: `FacilityReadService`

Operations:

- `findRoom`
- `findSeatTemplate`
- `findActiveSeatTemplatesByRoom`

### Showtime -> Catalog

Interface: `CatalogReadService`

Operations:

- `findMovie`: validates release date and enriches display title.
- `findEvent`: validates event reference and enriches display title.

### Showtime -> Facility

Interface: `FacilityReadService`

Operations:

- `findRoom`: validates room existence/maintenance and enriches room/cinema display data.
- `findSeatTemplate`: enriches realtime seat-map responses.
- `findActiveSeatTemplatesByRoom`: generates showtime seats from room templates.

### Facility -> Showtime

Interface: `FacilityShowtimeGuard`

Operations:

- `hasFutureShowtimesForRoom`
- `hasFutureShowtimesForRooms`

Legacy implementation uses JPA inside the monolith. Extracted Facility fails closed until a Showtime client is wired.

## Preserved Flows

- Customer holds seats through showtime locking.
- Customer creates pending order only if hold owner matches.
- Payment confirms held seats as booked, generates tickets, and marks order paid.
- Duplicate payment transaction returns the existing paid order when it is the same order.
- Refund checks refund window, rejects checked-in tickets, marks tickets refunded, releases booked seats.
- Staff counter booking books currently available seats directly and generates paid counter orders.

## Future Events

These are not implemented yet. They are the migration contract candidates once RabbitMQ or another broker is introduced.

- `catalog.movie.created`
- `catalog.movie.updated`
- `catalog.event.created`
- `seat.held`
- `seat.released`
- `seat.booked`
- `order.created`
- `order.paid`
- `order.refunded`
- `ticket.generated`
- `ticket.checked_in`
- `review.created`
- `review.updated`

## Migration Order Recommendation

1. Keep `backend_legacy` as the demo runtime until gateway cutover.
2. Catalog and Facility are extracted first and remain contract-compatible with legacy controllers.
3. Wire Catalog/Facility to Showtime where no-op/fail-closed adapters remain.
4. Keep booking/payment together until seat reservation and payment compensation tests are stable.
5. When extracting booking, replace `SeatReservationServiceImpl` consumers with an HTTP/message client that preserves the same contracts.
6. Add idempotency and compensation around payment before splitting payment from booking.

## Verification Checklist

- `OrderServiceImplTest`
- `PaymentServiceImplTest`
- `SeatReservationServiceImplTest`
- `TicketServiceImplTest`
- `ReviewServiceImplTest`
- `StaffBookingServiceImplTest`
- Manual flow: hold -> order -> payment -> ticket.
- Manual flow: hold expires -> payment rejected.
- Manual flow: paid order refund -> tickets refunded and seats available.
- Manual flow: staff counter booking -> order paid and tickets generated.
