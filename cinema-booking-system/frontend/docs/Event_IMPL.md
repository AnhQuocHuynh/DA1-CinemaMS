# Event Features Implementation Plan
# Done
This document outlines the steps required to fully support the "Event" part of the cinema booking system.

## User Review Required

> [!IMPORTANT]
> **Database Change**: We need to make the `movieId` column in the `showtimes` table nullable. Currently, it is strictly required. For events, `movieId` should be null while `eventId` will be populated. This might require a database migration or dropping/recreating the table if Hibernate doesn't do it automatically.

> [!IMPORTANT]
> **UI Decision**: Should the "Events" have their own dedicated search page, or should we merge them into a single "Catalog Search" page that searches both movies and events simultaneously? The backend API `/api/catalog/search` already supports searching both at once.

## 1. Booking Flow Analysis
You asked: *"Because events use the same booking as movie, does the booking need any edits?"*

**Answer**: **The core booking flow needs ZERO edits.** 
The booking mechanism (holding seats, selecting vouchers, processing payment) is entirely based on `showtimeId`. The backend `OrderController` and `SeatLockingService` do not care whether a showtime belongs to a movie or an event.

However, the **Showtime creation and fetching** logic needs a few minor edits to accommodate events, as currently, showtimes strictly require a `movieId`.

## 2. Backend Changes (Showtime Tweaks)

To allow showtimes for events, we must update the Showtime module:

### `Showtime.java` (Entity)
- [MODIFY] Change `@Column(nullable = false)` to `@Column(nullable = true)` for `movieId`.
- [MODIFY] Add `@Column(nullable = true)` for `eventId` (if not already properly configured).

### `ShowtimeRequest.java` (DTO)
- [MODIFY] Remove `@NotNull(message = "Movie ID không được để trống")` from `movieId`.
- [MODIFY] Add custom validation in the service layer to ensure that *either* `movieId` or `eventId` is provided.

### `ShowtimeRepository.java`
- [MODIFY] Add a new query method: `List<Showtime> findByEventIdAndStartTimeAfterOrderByStartTimeAsc(Long eventId, LocalDateTime time);`

### `ShowtimeService.java` & `ShowtimeServiceImpl.java`
- [MODIFY] Implement `getShowtimesByEvent(Long eventId)` using the new repository method.

### `ShowtimeController.java`
- [MODIFY] Add a new endpoint: `GET /event/{eventId}` to fetch showtimes for a specific event.

## 3. Frontend Changes

The frontend needs significant additions to expose events to users and admins.

### Services
- [NEW] `src/services/eventService.ts`: Implements the event-related API calls (`getEvents`, `getEventById`, admin CRUD methods).

### Public Pages
- [MODIFY] `src/pages/Home.tsx`: Add a new section below the "Now Showing" movies to display a grid of "Upcoming Events".
- [NEW] `src/pages/EventDetails.tsx`: Similar to `MovieDetails.tsx`. Displays event poster, venue, description, and a "Book Ticket" button that routes to showtimes.
- [MODIFY] `src/pages/MovieShowtimes.tsx` (Refactor to `Showtimes.tsx` or handle events): Modify this page so it can fetch showtimes using either `movieId` or `eventId` depending on the route parameters.
- [MODIFY] `src/components/SiteTopNav.tsx`: Add an "Events" link to the navigation bar.

### Admin Pages
- [NEW] `src/pages/admin/EventManagement.tsx`: Similar to `MovieManagement.tsx`. A datatable to create, update, and delete events.
- [MODIFY] `src/pages/admin/AdminDashboard.tsx`: Add the "Event Management" tab/route to the admin sidebar.
- [MODIFY] `src/pages/admin/ShowtimeManagement.tsx`: Allow admins to select an "Event" instead of a "Movie" when creating a new showtime.

## Verification Plan

### Automated Tests
- N/A for frontend.

### Manual Verification
1. **Admin Flow**: Log in as ADMIN, navigate to Event Management, create a new event.
2. **Showtime Flow**: Go to Showtime Management, create a showtime for the newly created event.
3. **User Flow**: Go to the homepage, see the event in the grid. Click it, view details, select "Book Ticket".
4. **Booking Flow**: Complete the seat selection and payment for the event. Verify the ticket is generated correctly.
