# Test Plan — Cinema Booking System Microservices Refactor

> **Date:** 2026-06-30
> **Purpose:** Ensure the monolith → microservices refactor introduces **zero regressions** to existing functionality.
> **Scope:** All 10 services (new microservices) + API Gateway + Frontend compatibility.

---

## Table of Contents

1. [Testing Strategy Overview](#1-testing-strategy-overview)
2. [Identity Service (ASP.NET)](#2-identity-service-aspnet)
3. [Catalog Service (Spring Boot)](#3-catalog-service-spring-boot)
4. [Facility Service (ASP.NET)](#4-facility-service-aspnet)
5. [Showtime Service (Spring Boot)](#5-showtime-service-spring-boot)
6. [Booking Service (Spring Boot)](#6-booking-service-spring-boot)
7. [Payment Service (ASP.NET)](#7-payment-service-aspnet)
8. [Notification Service (ASP.NET)](#8-notification-service-aspnet)
9. [Analytics Service (Spring Boot)](#9-analytics-service-spring-boot)
10. [Recommendation Service (Spring Boot)](#10-recommendation-service-spring-boot)
11. [API Gateway (ASP.NET YARP)](#11-api-gateway-aspnet-yarp)
12. [Frontend Compatibility Tests](#12-frontend-compatibility-tests)
13. [End-to-End Integration Tests](#13-end-to-end-integration-tests)
14. [Data Migration Verification](#14-data-migration-verification)

---

## 1. Testing Strategy Overview

### Test Pyramid

```
           ┌─────────────┐
           │   E2E Tests  │  ← Fewest: full user flows through all services
           ├──────────────┤
           │ Integration   │  ← Moderate: cross-service API calls, DB, messaging
           ├──────────────┤
           │  Unit Tests   │  ← Most: domain logic, handlers, validators, mappers
           └──────────────┘
```

### Key Principle: **Contract-First Regression Testing**

The frontend currently talks to a single monolith at `http://localhost:8080/api`. After refactoring, the same frontend must talk to the API Gateway and receive **identical response shapes**. Every test below is designed to catch contract-breaking changes.

### Response Envelope Convention

The legacy monolith wraps most responses in `ApiResponse<T>`:

```json
{
  "success": true,
  "message": "...",
  "data": { /* actual payload */ }
}
```

Some endpoints (Orders, Tickets, Reviews, Vouchers) return **raw responses without the wrapper**. Each new microservice **MUST** preserve the exact same wrapping behavior per endpoint. The tables below mark this explicitly.

---

## 2. Identity Service (ASP.NET)

**Owning Module (legacy):** `com.uit.cinema.iam` + `com.uit.cinema.core.security`
**Database:** `identity_db` (PostgreSQL)
**Port:** 5001

### 2.1 Unit Tests

| # | Test Target | What to Test | Why |
|---|---|---|---|
| U-ID-1 | JWT Token Generation | RS256 signing, correct claims (`sub`, `email`, `roles[]`, `exp`), token structure | Core auth; any deviation breaks all downstream services |
| U-ID-2 | JWT Token Validation | Valid token passes; expired token rejected; tampered signature rejected; malformed token rejected | Gateway depends on this for route protection |
| U-ID-3 | Password Hashing | BCrypt/Argon2 hash+verify round-trip; null/empty password handling | Security regression |
| U-ID-4 | Refresh Token Logic | Token rotation (old invalidated, new issued); expired refresh token rejected; reuse detection | Frontend stores and uses refresh tokens |
| U-ID-5 | Role Normalization | `ROLE_ADMIN` → `ADMIN` in JWT claims; multiple roles encoded correctly | Frontend parses `roles` from token to determine UI |
| U-ID-6 | Registration Validation | Duplicate email rejected; invalid email format rejected; password strength rules enforced | FluentValidation / Bean Validation parity |
| U-ID-7 | Password Reset Token | Token generated with correct TTL; expired token rejected; used token invalidated | Functional parity with legacy `ForgotPasswordRequest` |

### 2.2 Integration Tests

| # | Test Target | What to Test | Why |
|---|---|---|---|
| I-ID-1 | `POST /api/auth/register` | Register new user → 200 + `ApiResponse<String>` with success message; duplicate email → 409/400 | Frontend: `authService.register()` |
| I-ID-2 | `POST /api/auth/login` | Valid credentials → 200 + `ApiResponse<AuthResponse>` containing `accessToken`, `refreshToken`, `user { id, email, roles[] }` | Frontend: `authService.login()` — parses `data.accessToken`, `data.user.roles` |
| I-ID-3 | `POST /api/auth/refresh` | Valid refresh token → 200 + new `accessToken` + rotated `refreshToken` | Frontend: `refreshAccessToken()` interceptor auto-retries 401s |
| I-ID-4 | `POST /api/auth/logout` | Invalidates refresh token; subsequent refresh call fails | Frontend: `authService.logout()` |
| I-ID-5 | `POST /api/auth/forgot-password` | Valid email → 200 + success message (even if user doesn't exist — no info leak) | Frontend: `authService.forgotPassword()` |
| I-ID-6 | `POST /api/auth/reset-password` | Valid token + new password → 200 | Frontend: `authService.resetPassword()` |
| I-ID-7 | `GET /api/users` | ADMIN role → 200 + `ApiResponse<List<UserResponse>>` with `id`, `email`, `fullName`, `roles[]`; non-ADMIN → 403 | Frontend: `adminService.getUserManagement()`, `adminService.getUserPermissions()` |
| I-ID-8 | `GET /api/users/{id}` | Owner or ADMIN → 200 + `ApiResponse<UserResponse>`; others → 403 | Frontend: user profile |
| I-ID-9 | `GET /internal/users/count` | Returns total user count (internal API only) | Analytics Service consumes this |
| I-ID-10 | JWKS Endpoint | `GET /.well-known/jwks.json` returns valid RS256 public key | All other services validate JWT using this |
| I-ID-11 | Token Blacklist (Redis) | After logout, access token used again → 401 | Token revocation via Redis |
| I-ID-12 | Database Migration | `identity_db` contains `users`, `roles`, `refresh_tokens`, `password_reset_tokens` tables with correct schema | Data integrity post-migration |

---

## 3. Catalog Service (Spring Boot)

**Owning Module (legacy):** `com.uit.cinema.catalog`
**Database:** `catalog_db` (PostgreSQL)
**Port:** 8081

### 3.1 Unit Tests

| # | Test Target | What to Test | Why |
|---|---|---|---|
| U-CT-1 | Movie Service | `getAllActiveMovies()` filters `active=true`; `getMovieById()` throws on not found; create/update validates required fields | Core CRUD logic |
| U-CT-2 | Event Service | `getUpcomingEvents()` filters by date; `getAllEvents()` returns all; create validates `startTime < endTime` | Date logic correctness |
| U-CT-3 | Genre Service | Create genre with unique name; delete genre detaches from movies (M:N) | Referential integrity |
| U-CT-4 | Catalog Search Service | Keyword match, genre filter, date range filter, pagination (`page`, `size`) | Complex query logic |
| U-CT-5 | DTO Mappers (MapStruct) | Entity → Response mapping produces all expected fields: `id`, `title`, `description`, `durationMinutes`, `releaseDate`, `ageRating`, `posterUrl`, `trailerUrl`, `language`, `active`, `genres[]`, `createdAt`, `updatedAt` | Frontend `MovieResponse` type expects all these fields |
| U-CT-6 | Event Mapper | Entity → Response: `id`, `name`, `description`, `startTime`, `endTime`, `venue`, `imageUrl`, `active`, `createdAt`, `updatedAt` | Frontend `EventResponse` type match |

### 3.2 Integration Tests

| # | Test Target | What to Test | Response Wrapper | Why |
|---|---|---|---|---|
| I-CT-1 | `GET /api/movies` | Returns `List<MovieResponse>` with all active movies | `ApiResponse<>` | Frontend: `movieService.getMovies()` → reads `response.data.data` |
| I-CT-2 | `GET /api/movies/{id}` | Returns single `MovieResponse` with genres array | `ApiResponse<>` | Frontend: `movieService.getMovieById()` → reads `response.data.data` |
| I-CT-3 | `POST /api/movies` | ADMIN → creates movie → returns created `MovieResponse` | `ApiResponse<>` | Frontend: `adminService.createMovie()` |
| I-CT-4 | `PUT /api/movies/{id}` | ADMIN → updates movie → returns updated `MovieResponse` | `ApiResponse<>` | Frontend: `adminService.updateMovie()` |
| I-CT-5 | `DELETE /api/movies/{id}` | ADMIN → soft-deletes movie → returns `ApiResponse<Void>` | `ApiResponse<>` | Frontend: `adminService.deleteMovie()` |
| I-CT-6 | `GET /api/events` | Returns upcoming events only | `ApiResponse<>` | Frontend: `eventService.getEvents()` |
| I-CT-7 | `GET /api/events/all` | ADMIN → returns all events (including past) | `ApiResponse<>` | Frontend: `eventService.getAllEvents()` |
| I-CT-8 | `GET /api/events/{id}` | Returns single event | `ApiResponse<>` | Frontend: `eventService.getEventById()` |
| I-CT-9 | `POST /api/events` | ADMIN → creates event | `ApiResponse<>` | Frontend: `eventService.createEvent()` |
| I-CT-10 | `DELETE /api/events/{id}` | ADMIN → deletes event | `ApiResponse<>` | Frontend: `eventService.deleteEvent()` |
| I-CT-11 | `GET /api/genres` | Returns all genres: `List<{ id, name }>` | `ApiResponse<>` | Frontend: `movieService.getGenres()` |
| I-CT-12 | `POST /api/genres` | ADMIN → creates genre | `ApiResponse<>` | Frontend: `movieService.createGenre()` |
| I-CT-13 | `DELETE /api/genres/{id}` | ADMIN → deletes genre | `ApiResponse<>` | Frontend: `movieService.deleteGenre()` |
| I-CT-14 | `GET /api/catalog/search` | Returns `CatalogSearchResponse` with `movies[]`, `events[]`, pagination fields | `ApiResponse<>` | Frontend: `catalogService.search()` |
| I-CT-15 | `GET /internal/movies/{id}` | Returns movie title for Analytics enrichment (internal only) | Raw / Internal | Analytics Service consumes this |
| I-CT-16 | Event Publishing | On movie create/update → publishes `movie.created` / `movie.updated` to RabbitMQ `catalog.events` exchange | N/A | Recommendation Service + Analytics consume these |
| I-CT-17 | Database Migration | `catalog_db` has `movies`, `events`, `genres`, `movie_genres` tables | N/A | Schema parity |

---

## 4. Facility Service (ASP.NET)

**Owning Module (legacy):** `com.uit.cinema.facility`
**Database:** `facility_db` (PostgreSQL)
**Port:** 5002

### 4.1 Unit Tests

| # | Test Target | What to Test | Why |
|---|---|---|---|
| U-FC-1 | `CreateCinemaCommandHandler` | Creates cinema with valid Name + Address; rejects missing required fields | MediatR command handler logic |
| U-FC-2 | `GetCinemasQueryHandler` | Returns all active cinemas mapped to `CinemaDto` | Query handler logic |
| U-FC-3 | `CinemaRepository.GetAllAsync()` | Returns all cinemas from DB via EF; uses `AsNoTracking` for reads | Repository layer correctness |
| U-FC-4 | `CinemaRepository.GetByIdAsync()` | Returns cinema or null; doesn't throw on not found | Repository null-safety |
| U-FC-5 | `UnitOfWork.SaveChangesAsync()` | Commits changes; disposes context correctly | Transaction management |
| U-FC-6 | Cinema Entity Validation | `Name` required, `Address` required, `Active` defaults to `true` | Domain invariant |
| U-FC-7 | Room Entity Validation | `CinemaId` FK populated; `Name` required; `Active` defaults `true`; `UnderMaintenance` defaults `false` | Domain invariant |
| U-FC-8 | SeatTemplate Entity | `RowLabel` required; `ColumnNumber` non-negative; `ColumnSpan` defaults 1; `Pathway` defaults `false` | Domain invariant |
| U-FC-9 | CinemaConfiguration (EF) | Table mapped to `"cinemas"`; `Name` max 150 chars; `Address` max 255 chars; cascade delete to Rooms | EF Fluent API correctness |

### 4.2 Integration Tests

| # | Test Target | What to Test | Response Wrapper | Why |
|---|---|---|---|---|
| I-FC-1 | `GET /api/cinemas` | Returns `List<CinemaResponse>` with `{ id, name, address, city, phone, active }` | `ApiResponse<>` | Frontend: `cinemaService.getCinemas()` → reads `response.data.data`; `adminService.getTheaters()` |
| I-FC-2 | `GET /api/cinemas/{id}` | Returns single cinema | `ApiResponse<>` | Legacy: `CinemaController.getCinemaById()` |
| I-FC-3 | `POST /api/cinemas` | ADMIN → creates cinema → returns `CinemaResponse` | `ApiResponse<>` | Frontend: `adminService.createTheater()` sends `{ name, address, city, phone }` |
| I-FC-4 | `PUT /api/cinemas/{id}` | ADMIN → updates cinema | `ApiResponse<>` | Frontend: `adminService.updateTheater()` |
| I-FC-5 | `DELETE /api/cinemas/{id}` | ADMIN → deletes cinema (cascade deletes rooms) | `ApiResponse<>` | Frontend: `adminService.deleteTheater()` |
| I-FC-6 | `GET /api/cinemas/{cinemaId}/rooms` | Returns `List<RoomResponse>` with `{ id, name, type, totalSeats, rows, columns, active, underMaintenance }` | `ApiResponse<>` | Frontend: `adminService.getTheaters()` fetches rooms per cinema |
| I-FC-7 | `GET /api/cinemas/{cinemaId}/rooms/{roomId}` | Returns single room | `ApiResponse<>` | Room detail view |
| I-FC-8 | `POST /api/cinemas/{cinemaId}/rooms` | ADMIN → creates room with `cinemaId` set from path | `ApiResponse<>` | Frontend: `adminService.createRoom()` |
| I-FC-9 | `PUT /api/cinemas/{cinemaId}/rooms/{roomId}` | ADMIN → updates room | `ApiResponse<>` | Room editing |
| I-FC-10 | `DELETE /api/cinemas/{cinemaId}/rooms/{roomId}` | ADMIN → deletes room | `ApiResponse<>` | Frontend: `adminService.deleteRoom()` |
| I-FC-11 | `GET /api/cinemas/{cinemaId}/rooms/{roomId}/seats` | Returns `List<SeatTemplateResponse>` | `ApiResponse<>` | Frontend: `adminService.getRoomSeatMap()` |
| I-FC-12 | `PUT /api/cinemas/{cinemaId}/rooms/{roomId}/seats` | ADMIN → updates seat map | `ApiResponse<>` | Frontend: `adminService.updateRoomSeatMap()` |
| I-FC-13 | `GET /internal/rooms/{id}/seats` | Returns seat templates for Showtime Service (internal) | Raw / Internal | Showtime Service fetches room layout for seat generation |
| I-FC-14 | Database Migration | `facility_db` has `cinemas`, `rooms`, `seat_templates`, `seat_types` tables; EF migrations applied | N/A | Schema parity |

> [!IMPORTANT]
> **Critical Frontend Contract:** `adminService.getTheaters()` calls `GET /cinemas` then `GET /cinemas/{id}/rooms` for each cinema. It reads: `r.name`, `r.type`, `r.totalSeats`, `r.rows`, `r.columns`, `r.underMaintenance`. All these fields MUST be present in `RoomResponse`.

---

## 5. Showtime Service (Spring Boot)

**Owning Module (legacy):** `com.uit.cinema.showtime`
**Database:** `showtime_db` (PostgreSQL) + Redis
**Port:** 8082

### 5.1 Unit Tests

| # | Test Target | What to Test | Why |
|---|---|---|---|
| U-ST-1 | Showtime Creation | Validates room exists (via Facility API); validates no time overlap in same room; generates `ShowtimeSeat` rows from seat templates | Core scheduling logic |
| U-ST-2 | Seat Hold Logic | `holdSeats()` sets Redis keys with TTL (5 min); multiple holds on same seat rejected; only owner can release | Concurrency-critical |
| U-ST-3 | Seat Status FSM | `AVAILABLE → HELD → BOOKED`; `HELD → AVAILABLE` (on release/TTL expiry); `BOOKED` is terminal | State machine correctness |
| U-ST-4 | Seat Map Builder | Groups seats by row label, includes `seatType`, `price`, `columnSpan`, `pathway` flag, `status`, `label` | Frontend seat map rendering depends on exact field set |
| U-ST-5 | ShowtimeResponse Mapper | Maps to `{ id, movieId, eventId, roomId, cinemaName, roomName, startTime, endTime, basePrice }` | Frontend `ShowtimeResponse` type |

### 5.2 Integration Tests

| # | Test Target | What to Test | Response Wrapper | Why |
|---|---|---|---|---|
| I-ST-1 | `GET /api/showtimes/movie/{movieId}` | Returns `List<ShowtimeResponse>` | `ApiResponse<>` | Frontend: `showtimeService.getShowtimes()` |
| I-ST-2 | `GET /api/showtimes/event/{eventId}` | Returns `List<ShowtimeResponse>` | `ApiResponse<>` | Frontend: `showtimeService.getShowtimesByEvent()` |
| I-ST-3 | `GET /api/showtimes/room/{roomId}` | Returns `List<ShowtimeResponse>` | `ApiResponse<>` | Frontend: `showtimeService.getShowtimesByRoom()` |
| I-ST-4 | `GET /api/showtimes/{id}` | Returns single `ShowtimeResponse` | `ApiResponse<>` | Frontend: `showtimeService.getShowtime()` |
| I-ST-5 | `GET /api/showtimes/{id}/seats` | Returns `List<ShowtimeSeatResponse>` with `{ id, rowLabel, columnNumber, columnSpan, seatType, status, price, pathway, label }` | `ApiResponse<>` | Frontend: `bookingService.getSeatMap()` — critical, parses every field |
| I-ST-6 | `POST /api/showtimes/{id}/hold` | Auth'd user → holds seats by `seatIds` → 200; unauth'd → 401 | `ApiResponse<>` | Frontend: `bookingService.holdSeats()` sends `{ seatIds: number[] }` |
| I-ST-7 | `DELETE /api/showtimes/{id}/hold` | Auth'd user → releases seats by `seatIds` → 200 | `ApiResponse<>` | Frontend: `bookingService.releaseHeldSeats()` sends `{ seatIds }` in body |
| I-ST-8 | `POST /api/showtimes` | ADMIN/STAFF → creates showtime → returns `ShowtimeResponse` | `ApiResponse<>` | Frontend: `showtimeService.createShowtime()` |
| I-ST-9 | `DELETE /api/showtimes/{id}` | ADMIN → deletes showtime | `ApiResponse<>` | Frontend: `showtimeService.deleteShowtime()` |
| I-ST-10 | `POST /internal/seats/validate` | Validates seat hold ownership (Booking Service calls this) | Internal | Booking saga step |
| I-ST-11 | `POST /internal/seats/confirm` | Marks seats as `BOOKED` (Booking Service calls after payment) | Internal | Booking saga step |
| I-ST-12 | `POST /internal/seats/release` | Releases seats to `AVAILABLE` (on cancellation) | Internal | Booking saga compensation |
| I-ST-13 | `GET /internal/showtimes/{id}` | Returns showtime details for Booking Service | Internal | Refund window calculation |
| I-ST-14 | Redis TTL Expiry | Held seats automatically become `AVAILABLE` after 5 min | N/A | Seat locking correctness |
| I-ST-15 | Facility Service Integration | Showtime creation fetches room seat templates from Facility Service `GET /internal/rooms/{id}/seats` | N/A | Cross-service dependency |
| I-ST-16 | Event Publishing | `seat.held`, `seat.booked`, `seat.released`, `showtime.created` events published to RabbitMQ | N/A | Analytics + Notification consume these |

> [!WARNING]
> **Seat Map Contract is the most critical test.** The frontend `bookingService.getSeatMap()` reads every field from `ShowtimeSeatResponse`: `id`, `rowLabel`, `columnNumber`, `columnSpan`, `seatType`, `status`, `price`, `pathway` (or `isPathway`), `label`. Missing or renamed fields will break the seat selection UI entirely.

---

## 6. Booking Service (Spring Boot)

**Owning Module (legacy):** `com.uit.cinema.booking` + `com.uit.cinema.staff`
**Database:** `booking_db` (PostgreSQL)
**Port:** 8083

### 6.1 Unit Tests

| # | Test Target | What to Test | Why |
|---|---|---|---|
| U-BK-1 | Order Creation Logic | Validates held seats via Showtime Service; calculates total price; applies voucher discount; creates order with `PENDING` status | Core business logic |
| U-BK-2 | Voucher Application | Percentage discount calculated correctly; flat discount applied; expired voucher rejected; usage limit enforced | Financial accuracy |
| U-BK-3 | Ticket Generation | One ticket per seat; unique `ticketCode` generated; QR code data populated; price per ticket correct | Post-payment logic |
| U-BK-4 | Refund Window Check | Refund allowed if current time < showtime start time; refund rejected after showtime starts | Business rule enforcement |
| U-BK-5 | Order Status FSM | `PENDING → PAID → REFUNDED`; `PENDING → CANCELLED` (timeout); invalid transitions rejected | State machine |
| U-BK-6 | Staff Counter Booking | Staff can create booking on behalf of walk-in customer; staff ID recorded | Staff module parity |
| U-BK-7 | Review Eligibility | User can review only if they have a `PAID` order for the movie/event; one review per user per movie | Business rule |
| U-BK-8 | OrderResponseMapper | Maps order entity to `OrderResponse` with all fields the frontend expects | DTO contract |

### 6.2 Integration Tests

| # | Test Target | What to Test | Response Wrapper | Why |
|---|---|---|---|---|
| I-BK-1 | `POST /api/orders` | Creates order → returns `OrderResponse` with `{ id, userId, showtimeId, totalAmount, finalAmount, status, tickets }` | **Raw** (no wrapper) | Frontend: `bookingService.createOrder()` reads `response.data` directly |
| I-BK-2 | `POST /api/orders/{id}/pay` | Processes payment → returns updated `OrderResponse` with `status=PAID` | **Raw** | Frontend: `bookingService.processPayment()` |
| I-BK-3 | `POST /api/orders/{id}/refund` | Refunds order → returns updated `OrderResponse` with `status=REFUNDED` | **Raw** | Frontend: `bookingService.refundOrder()` |
| I-BK-4 | `GET /api/vouchers/validate/{code}` | Valid code → returns raw `Voucher` entity; invalid → 404 | **Raw** | Frontend: `bookingService.validateVoucher()` |
| I-BK-5 | `GET /api/vouchers` | ADMIN → returns `List<Voucher>` | **Raw** | Frontend: `adminService.getVouchers()` |
| I-BK-6 | `POST /api/vouchers` | ADMIN → creates voucher | **Raw** | Frontend: `adminService.createVoucher()` |
| I-BK-7 | `DELETE /api/vouchers/{id}` | ADMIN → deletes voucher → 204 No Content | **Raw** | Frontend: `adminService.deleteVoucher()` |
| I-BK-8 | `POST /api/tickets/check-in` | STAFF/ADMIN → checks in ticket by `ticketCode` → returns `TicketResponse` with `{ ticketCode, seatLabel, seatTypeName, status }` | **Raw** | Frontend: `bookingService.checkInTicket()`, `staffService.scanTicket()` |
| I-BK-9 | `GET /api/tickets/code/{code}` | Returns ticket with enriched fields: `movieName`, `movieTitle`, `eventTitle`, `displayTitle`, `startTime`, `endTime`, `cinemaName`, `roomName`, `seatLabel`, `seatTypeName`, `qrCodeData`, `price` | **Raw** | Frontend: `bookingService.getTicketByCode()` — reads all enriched fields |
| I-BK-10 | `GET /api/tickets/users/{userId}` | Returns user's tickets array | **Raw** | Frontend: `bookingService.getUserTickets()` |
| I-BK-11 | `GET /api/tickets/orders/{orderId}` | Returns all tickets for an order | **Raw** | Frontend: `bookingService.getOrderTickets()` |
| I-BK-12 | `POST /api/reviews` | Creates review → returns `ReviewResponse` | **Raw** | Frontend: `reviewService.createReview()` |
| I-BK-13 | `GET /api/reviews/movies/{movieId}` | Returns `List<ReviewResponse>` | **Raw** | Frontend: `reviewService.getMovieReviews()` |
| I-BK-14 | `GET /api/reviews/events/{eventId}` | Returns `List<ReviewResponse>` | **Raw** | Frontend: `reviewService.getEventReviews()` |
| I-BK-15 | `GET /api/reviews/movies/{movieId}/insight` | Returns `ReviewInsightResponse` (avg rating, count, distribution) | **Raw** | Frontend: `reviewService.getMovieInsight()` |
| I-BK-16 | `GET /api/reviews/events/{eventId}/insight` | Returns `ReviewInsightResponse` | **Raw** | Frontend: `reviewService.getEventInsight()` |
| I-BK-17 | `GET /api/reviews/movies/{movieId}/eligibility?userId=` | Returns `ReviewEligibilityResponse` | **Raw** | Frontend: `reviewService.checkMovieEligibility()` |
| I-BK-18 | `GET /api/reviews/events/{eventId}/eligibility?userId=` | Returns `ReviewEligibilityResponse` | **Raw** | Frontend: `reviewService.checkEventEligibility()` |
| I-BK-19 | `POST /api/staff/bookings` | STAFF/ADMIN → counter booking → returns `ApiResponse<OrderResponse>` | `ApiResponse<>` | Frontend: `staffService.createCounterBooking()` |
| I-BK-20 | `GET /api/staff/dashboard/summary` | STAFF/ADMIN → returns `StaffDashboardSummaryResponse` | `ApiResponse<>` | Frontend: `staffService.getStaffDashboard()` |
| I-BK-21 | `GET /api/staff/dashboard/bookings/today?limit=10` | STAFF/ADMIN → returns today's bookings | `ApiResponse<>` | Frontend: `staffService.getBookingsList()` |
| I-BK-22 | `GET /api/staff/dashboard/validation/stats` | STAFF/ADMIN → validation statistics | `ApiResponse<>` | Frontend: `staffService.getValidationStats()` |
| I-BK-23 | `GET /api/staff/dashboard/validation/bookings?limit=20` | STAFF/ADMIN → validation bookings list | `ApiResponse<>` | Frontend: `staffService.getValidationBookings()` |
| I-BK-24 | Showtime Service Call | Order creation validates seats via `POST /internal/seats/validate` | N/A | Cross-service call |
| I-BK-25 | Event Publishing | `order.created`, `order.paid`, `order.refunded`, `order.cancelled`, `review.created`, `review.updated` events published | N/A | Payment, Notification, Analytics, Recommendation consume these |

> [!IMPORTANT]
> **Response wrapper inconsistency is the #1 regression risk.** The Booking module has mixed wrapping: Orders/Tickets/Reviews return **raw** responses, while Staff endpoints use `ApiResponse<>`. Each new microservice endpoint must match the legacy wrapping exactly.

---

## 7. Payment Service (ASP.NET)

**Owning Module (legacy):** Extracted from `com.uit.cinema.booking.service.PaymentServiceImpl`
**Database:** `payment_db` (PostgreSQL)
**Port:** 5003

### 7.1 Unit Tests

| # | Test Target | What to Test | Why |
|---|---|---|---|
| U-PY-1 | Payment Processing | Validates order exists and is `PENDING`; records payment method + transaction ID; marks order `PAID` | Core payment flow |
| U-PY-2 | Refund Processing | Validates refund window (showtime not started); creates refund record; publishes `payment.refunded` event | Business rule |
| U-PY-3 | Idempotency Key | Duplicate `transactionId` rejected (unique constraint) | Prevents double-charge |
| U-PY-4 | Payment Gateway Integration | Mock gateway adapter returns success/failure; service handles both cases | Adapter pattern test |

### 7.2 Integration Tests

| # | Test Target | What to Test | Why |
|---|---|---|---|
| I-PY-1 | `payment.completed` event | Consumed by Booking Service → order status updated to `PAID` → tickets generated | Saga coordination |
| I-PY-2 | `payment.failed` event | Consumed by Booking Service → order cancelled → seats released | Compensation |
| I-PY-3 | `payment.refunded` event | Consumed by Booking Service → order status updated to `REFUNDED` | Saga completion |
| I-PY-4 | Database Migration | `payment_db` has `payments`, `txn_log` tables | Schema |

> [!NOTE]
> The legacy monolith processes payments inline within `OrderController`. The new Payment Service handles payments via **events**. The `POST /api/orders/{id}/pay` endpoint on Booking Service should now publish an event rather than calling payment logic directly. Verify the frontend still receives the same final `OrderResponse` shape.

---

## 8. Notification Service (ASP.NET)

**Owning Module (legacy):** New service (no direct legacy equivalent)
**Database:** `notification_db` (MongoDB)
**Port:** 5004

### 8.1 Unit Tests

| # | Test Target | What to Test | Why |
|---|---|---|---|
| U-NF-1 | Email Template Rendering | Booking confirmation, payment receipt, password reset templates render correctly with dynamic data | Template correctness |
| U-NF-2 | Event Consumer Deserialization | `order.paid`, `user.registered`, `order.refunded` event payloads deserialized without error | Schema compatibility |

### 8.2 Integration Tests

| # | Test Target | What to Test | Why |
|---|---|---|---|
| I-NF-1 | `user.registered` event → Welcome email | Consumer receives event, creates notification record, sends email (or logs in dev) | User onboarding |
| I-NF-2 | `order.paid` event → Booking confirmation | Consumer creates notification with order details | Post-booking UX |
| I-NF-3 | `order.refunded` event → Refund notification | Consumer sends refund confirmation | Refund flow |
| I-NF-4 | `user.password.reset` event → Reset email | Consumer sends password reset link email | Auth flow |
| I-NF-5 | Dead Letter Queue | Failed message processing → message routed to DLQ → retry works | Reliability |

---

## 9. Analytics Service (Spring Boot)

**Owning Module (legacy):** `com.uit.cinema.admin`
**Database:** `analytics_db` (ClickHouse / PostgreSQL fallback)
**Port:** 8084

### 9.1 Unit Tests

| # | Test Target | What to Test | Why |
|---|---|---|---|
| U-AN-1 | Dashboard Overview Aggregation | Total revenue, total bookings, active users, total movies, occupancy rate, seats sold/available calculations | Financial accuracy |
| U-AN-2 | Revenue Time Series | Daily/weekly/monthly bucketing; correct sum per bucket; date range filtering | Chart data correctness |
| U-AN-3 | Popular Movies Ranking | Scoring algorithm (tickets sold + revenue weighted); limit parameter respected | Ranking logic |
| U-AN-4 | Live Sales Feed | Returns most recent N paid orders with enriched movie titles | Real-time dashboard |

### 9.2 Integration Tests

| # | Test Target | What to Test | Response Wrapper | Why |
|---|---|---|---|---|
| I-AN-1 | `GET /api/admin/dashboard/overview` | ADMIN → returns `AdminDashboardOverviewResponse` with `totalRevenue`, `totalBookings`, `activeUsers`, `totalMovies`, `occupancyRate`, `seatsSold`, `seatsAvailable` | `ApiResponse<>` | Frontend: `adminService.getDashboardOverview()` |
| I-AN-2 | `GET /api/admin/dashboard/revenue-series` | ADMIN → returns `List<AdminRevenuePointResponse>` with `{ date, revenue, orders, tickets }` | `ApiResponse<>` | Frontend: `adminService.getRevenueSeries()` |
| I-AN-3 | `GET /api/admin/dashboard/live-sales?limit=5` | ADMIN → returns recent sales with `{ movieTitle, tickets, amount, time }` | `ApiResponse<>` | Frontend: `adminService.getLiveSales()` |
| I-AN-4 | `GET /api/admin/dashboard/popular-movies?limit=5` | ADMIN → returns popular movies with `{ title, score, ticketsSold, revenue }` | `ApiResponse<>` | Frontend: `adminService.getPopularMovies()` |
| I-AN-5 | Cross-Service Enrichment | Analytics calls Catalog `GET /internal/movies/{id}` for movie titles; calls Identity `GET /internal/users/count` for user count | N/A | Service-to-service correctness |
| I-AN-6 | Event Ingestion | Consumes `order.paid`, `order.refunded`, `movie.created`, `seat.booked` events and updates aggregations | N/A | Event-driven data pipeline |

---

## 10. Recommendation Service (Spring Boot)

**Owning Module (legacy):** New service (greenfield)
**Database:** Neo4j 5.x + Redis cache
**Port:** 8085

### 10.1 Unit Tests

| # | Test Target | What to Test | Why |
|---|---|---|---|
| U-RC-1 | Collaborative Filtering Query | Given test graph data → returns expected movie recommendations sorted by relevance score | Core algorithm |
| U-RC-2 | Content-Based Fallback | User with < 3 bookings → genre-preference based recommendations returned | Tier 2 fallback |
| U-RC-3 | Popularity Fallback | Anonymous/new user → top movies by booking count + rating returned | Tier 3 fallback |
| U-RC-4 | Tier Selection Logic | ≥ 3 bookings → Tier 1; 1-2 bookings → Tier 2; 0 bookings → Tier 3 | Algorithm routing |
| U-RC-5 | Event Deserialization | `order.paid`, `review.created`, `movie.created`, `user.registered` payloads parsed correctly | Schema compat |

### 10.2 Integration Tests

| # | Test Target | What to Test | Why |
|---|---|---|---|
| I-RC-1 | `GET /api/recommendations/movies` | Auth'd user → personalized `RecommendationResponse` with `algorithm`, `recommendations[]`, `metadata` | Frontend consumption |
| I-RC-2 | `GET /api/recommendations/movies/popular` | Unauth'd → globally popular movies | Anonymous users |
| I-RC-3 | `GET /api/recommendations/movies/{movieId}/similar` | Returns similar movies by genre + co-watching patterns | Movie detail page |
| I-RC-4 | Graph Sync: `order.paid` | Event → creates `[:WATCHED]` edge in Neo4j | Data sync |
| I-RC-5 | Graph Sync: `review.created` | Event → creates `[:RATED]` edge with rating value | Data sync |
| I-RC-6 | Graph Sync: `movie.created` | Event → creates `(:Movie)` node + `[:BELONGS_TO]` edges | Data sync |
| I-RC-7 | Cache Invalidation | New order for user → `rec:user:{userId}` cache cleared → next request recalculates | Cache freshness |
| I-RC-8 | Data Backfill | `--backfill` mode loads existing users, movies, orders, reviews into Neo4j | Initial deployment |

---

## 11. API Gateway (ASP.NET YARP)

**Port:** 5000

### 11.1 Unit Tests

| # | Test Target | What to Test | Why |
|---|---|---|---|
| U-GW-1 | Route Configuration | All route patterns from §7.2 of architecture doc are registered correctly | Routing completeness |
| U-GW-2 | JWT Middleware | Valid JWT → request forwarded with `X-User-Id`, `X-User-Roles` headers; invalid/missing → 401 for protected routes | Auth propagation |
| U-GW-3 | CORS Configuration | Frontend origin (`http://localhost:5173`) allowed; credentials allowed; correct methods/headers | Frontend can reach gateway |

### 11.2 Integration Tests

| # | Test Target | What to Test | Why |
|---|---|---|---|
| I-GW-1 | Route: `/api/auth/**` → Identity Service | Login/register/refresh/logout all proxied correctly | Auth flow |
| I-GW-2 | Route: `/api/movies/**` → Catalog Service | GET (no auth) works; POST/PUT/DELETE (ADMIN) works | Catalog access |
| I-GW-3 | Route: `/api/cinemas/**` → Facility Service | GET (no auth) works; POST/PUT/DELETE (ADMIN) works | Facility access |
| I-GW-4 | Route: `/api/showtimes/**` → Showtime Service | All showtime routes proxied, including `/hold` | Showtime access |
| I-GW-5 | Route: `/api/orders/**` → Booking Service | All order routes proxied with auth | Booking access |
| I-GW-6 | Route: `/api/tickets/**` → Booking Service | Check-in, user tickets, order tickets | Ticket access |
| I-GW-7 | Route: `/api/vouchers/**` → Booking Service | Voucher CRUD and validation | Voucher access |
| I-GW-8 | Route: `/api/reviews/**` → Booking Service | Review CRUD and eligibility | Review access |
| I-GW-9 | Route: `/api/admin/dashboard/**` → Analytics Service | ADMIN-only analytics endpoints | Dashboard access |
| I-GW-10 | Route: `/api/staff/**` → Booking Service | STAFF/ADMIN dashboard and counter booking | Staff access |
| I-GW-11 | Route: `/api/recommendations/**` → Recommendation Service | Auth'd and unauth'd recommendation endpoints | Recommendation access |
| I-GW-12 | Internal Route Blocking | `GET /internal/**` → 404 (blocked at gateway) | Security: internal APIs not exposed |
| I-GW-13 | Rate Limiting | Exceed rate limit → 429 Too Many Requests | Abuse prevention |
| I-GW-14 | Circuit Breaker | Downstream service down → 503 + graceful error (not hang) | Fault tolerance |
| I-GW-15 | Health Checks | `/health` returns 200; unhealthy downstream → degraded status | Observability |

---

## 12. Frontend Compatibility Tests

**Base URL change:** `http://localhost:8080/api` → `http://localhost:5000/api` (via API Gateway)

> [!CAUTION]
> The frontend **must not require any code changes** after the refactor. All tests below verify that switching `VITE_API_BASE_URL` is the only change needed.

### 12.1 API Contract Smoke Tests

These are automated HTTP tests (Postman/Newman or Playwright) that hit the **Gateway** and verify response shapes match what the frontend TypeScript types expect.

| # | Frontend Call | Expected Response Shape | Critical Fields |
|---|---|---|---|
| FE-1 | `authService.login()` | `{ success, data: { accessToken, refreshToken, user: { id, email, roles[] } } }` | `data.accessToken`, `data.user.roles` |
| FE-2 | `authService.register()` | `{ success, data: "..." }` | String message |
| FE-3 | `cinemaService.getCinemas()` | `{ success, data: [{ id, name, address, city, phone, active }] }` | All fields of `CinemaResponse` |
| FE-4 | `movieService.getMovies()` | `{ success, data: [{ id, title, genres[], posterUrl, ... }] }` | `genres[]` must be `string[]` |
| FE-5 | `movieService.getGenres()` | `{ success, data: [{ id, name }] }` | Array of `{ id, name }` |
| FE-6 | `eventService.getEvents()` | `{ success, data: [{ id, name, startTime, endTime, venue, imageUrl, ... }] }` | All `EventResponse` fields |
| FE-7 | `showtimeService.getShowtimes(movieId)` | `{ success, data: [ShowtimeResponse] }` | Showtime has `cinemaName`, `roomName` |
| FE-8 | `bookingService.getSeatMap(showtimeId)` | `{ success, data: [{ id, rowLabel, columnNumber, seatType, status, price, pathway, label, columnSpan }] }` | **Every field** |
| FE-9 | `bookingService.holdSeats()` | `{ success, data: null }` | 200 OK |
| FE-10 | `bookingService.createOrder()` | `OrderResponse` (raw, no wrapper) | `id`, `totalAmount`, `finalAmount`, `status` |
| FE-11 | `bookingService.processPayment()` | `OrderResponse` (raw) | `status` changes to `PAID` |
| FE-12 | `bookingService.validateVoucher()` | `Voucher` (raw) with `discountType`, `discountValue`, `validUntil`, `active` | Raw object, 404 for invalid |
| FE-13 | `bookingService.getTicketByCode()` | Raw ticket with enriched fields: `movieName`, `cinemaName`, `roomName`, `seatLabel`, `startTime` | All enriched fields present |
| FE-14 | `adminService.getDashboardOverview()` | `{ success, data: { totalRevenue, totalBookings, activeUsers, totalMovies, occupancyRate, seatsSold, seatsAvailable } }` | Numeric values, not strings |
| FE-15 | `adminService.getTheaters()` → rooms | Each room has `{ id, name, type, totalSeats, rows, columns, underMaintenance }` | Room fields for theater management UI |
| FE-16 | `staffService.scanTicket()` | Raw `{ ticketCode, seatLabel, seatTypeName, status }` | `status` = `"CHECKED_IN"` |
| FE-17 | `catalogService.search()` | `{ success, data: { movies[], events[], movieTotalPages, eventTotalPages, movieTotalElements, eventTotalElements } }` | Pagination fields |

---

## 13. End-to-End Integration Tests

These test full user journeys across multiple services to verify the system works as a whole.

### E2E-1: Complete Booking Flow

```
1. Login → Identity Service (POST /auth/login)
2. Browse Movies → Catalog Service (GET /movies)
3. Select Showtime → Showtime Service (GET /showtimes/movie/{id})
4. View Seat Map → Showtime Service (GET /showtimes/{id}/seats)
5. Hold Seats → Showtime Service (POST /showtimes/{id}/hold)
6. Validate Voucher → Booking Service (GET /vouchers/validate/{code})
7. Create Order → Booking Service (POST /orders)
8. Process Payment → Booking Service (POST /orders/{id}/pay)
   └── Payment Service handles payment (async event)
   └── Showtime Service confirms seats (internal call)
9. View Tickets → Booking Service (GET /tickets/orders/{orderId})
10. Notification → Notification Service receives order.paid event → sends email
11. Recommendation → Recommendation Service receives order.paid → creates graph edges
```

**Pass Criteria:** Order status reaches `PAID`, tickets generated with QR codes, seats marked `BOOKED`, notification sent, graph edge created.

### E2E-2: Refund Flow

```
1. Login as user
2. Create and pay for order (E2E-1 steps 1-8)
3. Refund Order → Booking Service (POST /orders/{id}/refund)
   └── Payment Service refunds (async event)
   └── Showtime Service releases seats (internal call)
4. Verify seats are AVAILABLE again
5. Notification → Refund email sent
```

### E2E-3: Admin Theater Management

```
1. Login as ADMIN → Identity Service
2. Create Cinema → Facility Service (POST /cinemas)
3. Create Room → Facility Service (POST /cinemas/{id}/rooms)
4. Update Seat Map → Facility Service (PUT /cinemas/{id}/rooms/{id}/seats)
5. Create Showtime in new room → Showtime Service (POST /showtimes)
6. Verify seat map generated → Showtime Service (GET /showtimes/{id}/seats)
```

### E2E-4: Staff Counter Booking

```
1. Login as STAFF → Identity Service
2. View Dashboard → Booking Service (GET /staff/dashboard/summary)
3. Create Counter Booking → Booking Service (POST /staff/bookings)
4. Check-in Ticket → Booking Service (POST /tickets/check-in)
```

### E2E-5: Admin Dashboard Analytics

```
1. Login as ADMIN
2. Get Overview → Analytics Service (GET /admin/dashboard/overview)
3. Get Revenue Chart → Analytics Service (GET /admin/dashboard/revenue-series)
4. Get Live Sales → Analytics Service (GET /admin/dashboard/live-sales)
5. Get Popular Movies → Analytics Service (GET /admin/dashboard/popular-movies)
```

---

## 14. Data Migration Verification

### 14.1 Schema Parity

| Legacy Table (cinema_db) | Target Service | Target DB | Verification |
|---|---|---|---|
| `users`, `roles`, `user_roles`, `refresh_tokens`, `password_reset_tokens` | Identity Service | `identity_db` | Row counts match; passwords still verifiable |
| `movies`, `events`, `genres`, `movie_genres` | Catalog Service | `catalog_db` | Row counts match; M:N relationships intact |
| `cinemas`, `rooms`, `seat_templates`, `seat_types` | Facility Service | `facility_db` | Row counts match; FK relationships intact; seat maps identical |
| `showtimes`, `showtime_seats` | Showtime Service | `showtime_db` | Row counts match; seat statuses preserved |
| `orders`, `tickets`, `vouchers`, `reviews` | Booking Service | `booking_db` | Row counts match; financial amounts exact; ticket codes preserved |

### 14.2 Data Integrity Spot Checks

| # | Check | How |
|---|---|---|
| DM-1 | User can login with pre-migration password | Login with known test account credentials |
| DM-2 | Existing tickets have valid QR codes | Scan a known ticket code → check-in succeeds |
| DM-3 | Historical order amounts are exact | Compare `totalAmount` / `finalAmount` for 10 random orders against legacy DB |
| DM-4 | Movie-Genre relationships intact | Query a movie with known genres → same genres returned |
| DM-5 | Seat templates match visual layout | Compare seat map for 3 known rooms against legacy response |
| DM-6 | Active/inactive flags preserved | Count active cinemas, movies, vouchers — counts match legacy |

---

## Appendix: Test Tooling Recommendations

| Stack | Unit Test Framework | Integration Test | E2E |
|---|---|---|---|
| **Spring Boot** services | JUnit 5 + Mockito | `@SpringBootTest` + Testcontainers (PostgreSQL, Redis, RabbitMQ) | Postman/Newman or REST Assured |
| **ASP.NET** services | xUnit + Moq / NSubstitute | `WebApplicationFactory<>` + Testcontainers | Postman/Newman |
| **Frontend** | Vitest (unit) | Playwright (API contract tests against Gateway) | Playwright (full UI flows) |
| **Cross-Service** | — | Docker Compose test environment with all services | Postman collection run |

> [!TIP]
> The existing `cinema_booking_system.postman_collection.json` in the repo root contains all legacy API calls. Convert this to a regression test suite: run it against the Gateway and assert all responses match expected shapes.
