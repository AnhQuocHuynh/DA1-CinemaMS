# Spring Boot Services Handoff: Changes & Architecture Documentation

## 1. Overview & Scope

This document provides a comprehensive handover summary of all modifications, additions, and architecture changes made to the Spring Boot microservices ecosystem—primarily **`booking-service`**—as well as associated infrastructure and event choreography contracts.

### Services Affected
- **`booking-service`** (Java 21, Spring Boot 3.3.x): Core booking domain, outbox dispatching, payment integration, and RabbitMQ event handling.
- **`infrastructure/docker-compose.yml`**: Added inter-service discovery configuration for `payment-service`.

---

## 2. Key Features & Architectural Changes

### A. Dynamic Refund Calculation & Synchronous Gateway Refund
- **Showtime-Aware Refund Tiers**:
  - `> 24 hours` before showtime: **100% refund**.
  - `4 hours to 24 hours` before showtime: **50% refund**.
  - `< 4 hours` before showtime: **0% (Non-refundable)**.
  - If any ticket is already marked `CHECKED_IN`, refund is disallowed.
- **REST Client Integration (`HttpPaymentService`)**:
  - Synchronously invokes the .NET `payment-service` endpoint:
    `POST /api/payments/order/{orderId}/refund`
  - Passes payload `{"amount": <refundAmount>, "reason": <reason>}` with `X-Internal-Token` header.
  - **Fail-Safe Design**: Payment refund must succeed *before* ticket and order status are flipped to `REFUNDED` and seats released. If the gateway fails, a `CustomException` is raised, rolling back the database transaction.
- **Real-Time Refund Metadata in `OrderResponse`**:
  - `refundable` (boolean) and `refundPercent` (int) computed dynamically in `OrderResponseMapper` whenever order status is `PAID`.

### B. Duplicate Pending Order Prevention (Idempotency Guard)
- **Constraint**: A user cannot create a second pending order for the same showtime if an unexpired `PENDING` order already exists.
- **Domain Exception**: `DuplicatePendingOrderException` returns HTTP `409 CONFLICT` with payload:
  ```json
  {
    "code": "DUPLICATE_PENDING_ORDER",
    "errorCode": "DUPLICATE_PENDING_ORDER",
    "existingOrderId": 12345,
    "message": "A pending order already exists for this showtime"
  }
  ```
- Allows frontend to automatically redirect the user back to checkout for their existing reservation rather than failing unpredictably.

### C. Outbox Event Publication on Order Creation (`order.created`)
- Added `BookingOutboxEventWriter.orderCreated(Order order)` to write an outbox record on order creation.
- Emits routing key `order.created` with payload:
  ```json
  {
    "orderId": 123,
    "userId": 456,
    "totalAmount": 200000.00,
    "discountAmount": 0.00,
    "finalAmount": 200000.00
  }
  ```
- Consumed by `payment-service` to initialize payment sagas and reserve payment slots asynchronously.

### D. Expired Order Event Handling (`order.expired`)
- Configured RabbitMQ consumer queue `booking.payment.expired.v1` bound to topic exchange on routing key `order.expired`.
- In `PaymentServiceImpl.applyExpiredPayment(...)`:
  - Validates order state (`PENDING`).
  - Releases held seats in Redis / Showtime via `SeatReservationService.releaseHeldSeats(...)`.
  - Sets order status to `CANCELLED`.
  - Handles idempotency (returns `ALREADY_APPLIED` if order was already cancelled).

### E. User Order History Endpoint
- Added endpoint `GET /api/orders/users/{userId}` to retrieve user's order history ordered by creation date descending (`createdAt DESC`).
- Enforces user authorization via `AuthenticatedUserIdResolver.authorizeRequestedUser(userId)`.

### F. Staff Counter Booking Cash Settlement & Anonymous Order User Matching
- **Anonymous Walk-In Support**: Added `Order.ANONYMOUS_USER_ID = 0L` to support anonymous customers purchasing tickets at the counter without a user account.
- **User Mismatch Bypass**:
  - In `PaymentServiceImpl.assertUserMatches(order, userId)`:
    - Bypasses userId check when `order.getSalesChannel() == Order.SalesChannel.COUNTER` and `order.getUserId() == Order.ANONYMOUS_USER_ID`.
    - Fixes the bug where counter cash orders failed with `"Payment userId does not match order owner"`.
- **Immediate Cash Settlement**:
  - `payment-service` now completes CASH payments immediately upon staff initiation and emits `payment.completed` (`paymentMethod = "CASH"`).
  - `booking-service` receives `payment.completed`, marks the order as `PAID`, confirms seats, and generates tickets instantly.

### G. Loyalty Points Outbox Emission (`loyalty.points.earned`)
- Added `BookingOutboxEventWriter.emitLoyaltyPointsEarned(userId, orderId, finalAmount)` to emit `loyalty.points.earned` events whenever an order is marked `PAID`.
- Automatically skipped for anonymous walk-in counter orders (`userId == 0L`), ensuring loyalty points are only awarded to authenticated members.

### H. Staff Counter Booking, Admission & Operational Aggregations
- **Dedicated Staff API Surface (`StaffBookingController`)**:
  - Guarded by `@PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")` under route prefix `/api/staff/**`.
  - Matched by YARP API Gateway policy `admin-or-staff` and Spring Security filter rule `.requestMatchers("/api/staff/**").hasAnyRole("STAFF", "ADMIN")`.
- **Counter Booking Workflow (`POST /api/staff/bookings`)**:
  - Allows staff to book tickets directly for walk-in customers (`userId = 0L`) or registered members.
  - Supports instant Cash settlement, immediately marking the order as `PAID` and generating tickets.
- **Saga Compensation Pattern for Inter-Service Consistency**:
  - In `StaffBookingServiceImpl.createCounterBooking()`:
    1. Synchronously calls `SeatReservationService.bookAvailableSeats(...)` in `showtime-service`.
    2. Encloses subsequent order persistence, ticket creation, and outbox event dispatch in a `try-catch(RuntimeException ex)` block.
    3. **Automated Compensating Action**: If order saving or ticket generation throws any exception, it immediately calls `seatReservationService.releaseBookedSeats(...)` to release the booked seats back to `AVAILABLE`. This guarantees no orphaned booked seats remain stuck in `showtime-service`.
- **Operational Dashboard Aggregations (CQRS Read Projections)**:
  - `GET /api/staff/dashboard/summary`: Aggregates today's total bookings, tickets sold, and peak sales hour.
  - `GET /api/staff/dashboard/bookings/today`: Chronological stream of today's paid orders for the counter ledger.
  - `GET /api/staff/dashboard/validation/stats`: Total validated vs pending check-ins for the active operational window.
  - `GET /api/staff/dashboard/validation/bookings`: Validation list returning `#BK-{orderId}` identifiers with dynamic status (`"pending"` if any tickets remain unvalidated, `"validated"` once all tickets are checked in).

### I. Downstream Error Propagation & Anti-Masking (`HttpSeatReservationService`)
- **Problem**: Previously, `HttpSeatReservationService` caught all `RestClientException` errors and blindly masked them as `503 SERVICE_UNAVAILABLE` ("Showtime reservation service is unavailable"). This hid real business validation errors (e.g., HTTP `409 Conflict` when a seat was already held or booked).
- **Solution**:
  - Distinguishes between HTTP 5xx / connection failures (which throw 503 `SHOWTIME_RESERVATION_UNAVAILABLE`) and HTTP 4xx client errors (e.g. 409 `SEAT_NOT_AVAILABLE`, 400 `INVALID_INPUT`).
  - Reads downstream error JSON payloads via Jackson `ObjectMapper` and preserves the original HTTP status, error code, and localized message in a `CustomException`.
  - Prevents false-alarm service outages on the frontend.

### J. Global Exception Handling: Argument Type Mismatch Protection
- Added `@ExceptionHandler(MethodArgumentTypeMismatchException.class)` in `GlobalExceptionHandler.java`.
- Catches invalid path variable or parameter conversions (such as `/api/tickets/orders/NaN`) and returns structured **HTTP 400 Bad Request** (`INVALID_INPUT`) instead of cascading into an unhandled **HTTP 500 Internal Server Error**.

---

## 3. Comprehensive File Inventory

### New Files Created

| File Path | Description |
| :--- | :--- |
| [`StaffBookingController.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/controller/StaffBookingController.java) | REST controller handling counter booking and staff operational dashboard endpoints under `/api/staff/**`. |
| [`StaffBookingService.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/StaffBookingService.java) | Service contract for staff counter booking and validation reporting. |
| [`StaffBookingServiceImpl.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/Impl/StaffBookingServiceImpl.java) | Implementation orchestrating counter booking, compensating seat releases, and dashboard queries. |
| [`StaffCounterBookingRequest.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/dto/request/StaffCounterBookingRequest.java) | DTO for counter booking creation (showtimeId, seatIds, customer info, payment method). |
| [`StaffBookingListItemResponse.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/dto/response/StaffBookingListItemResponse.java) | DTO representing a booking row in staff today's bookings ledger. |
| [`StaffBookingValidationResponse.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/dto/response/StaffBookingValidationResponse.java) | DTO representing an order validation entry (`#BK-{orderId}`) on the ticket lookup dashboard. |
| [`StaffDashboardSummaryResponse.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/dto/response/StaffDashboardSummaryResponse.java) | DTO for staff summary statistics (todayBookings, totalTicketsSold, peakHour). |
| [`StaffValidationStatsResponse.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/dto/response/StaffValidationStatsResponse.java) | DTO for validation statistics (totalValidated, pendingCheckIns, totalBookings). |
| [`StaffBookingServiceImplTest.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/test/java/com/uit/cinema/booking/service/Impl/StaffBookingServiceImplTest.java) | Unit test suite covering counter bookings, compensation rollback on save failure, and `#BK-` formatting. |
| [`HttpPaymentService.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/client/HttpPaymentService.java) | Spring `RestClient` wrapper to communicate synchronously with `payment-service` (`POST /api/payments/order/{orderId}/refund`). Injects `services.payment.url` and `app.internal-token`. |
| [`PaymentExpiredPayload.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/messaging/PaymentExpiredPayload.java) | Record representing the JSON payload of `order.expired` events (`correlationId`, `paymentId`, `orderId`, `userId`, `reason`). |
| [`DuplicatePendingOrderException.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/core/exception/DuplicatePendingOrderException.java) | Domain exception carrying `existingOrderId`, mapping to HTTP `409 Conflict`. |

---

### Modified Files & Detailed Changes

#### 1. Controller & DTO Layer
- **[`OrderController.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/controller/OrderController.java)**
  - Added `GET /api/orders/users/{userId}` endpoint.
  - Authorized with `userIdResolver.authorizeRequestedUser(userId)`.
- **[`OrderResponse.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/dto/response/OrderResponse.java)**
  - Added fields: `boolean refundable` and `int refundPercent`.
- **[`OrderResponseMapper.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/mapper/OrderResponseMapper.java)**
  - Implemented `calculateRefundPercent(LocalDateTime showtimeStart, LocalDateTime now)` logic.
  - Computes `refundable` and `refundPercent` during response projection.
- **[`GlobalExceptionHandler.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/core/exception/GlobalExceptionHandler.java)**
  - Added `@ExceptionHandler(DuplicatePendingOrderException.class)` returning structured `409 Conflict` JSON response.

#### 2. Domain & Service Layer
- **[`Order.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/entity/Order.java)**
  - Added `public static final Long ANONYMOUS_USER_ID = 0L;` constant.
- **[`OrderRepository.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/repository/OrderRepository.java)**
  - Added `boolean existsByUserIdAndShowtimeIdAndStatus(Long userId, Long showtimeId, Order.OrderStatus status);`
  - Added `Optional<Order> findByUserIdAndShowtimeIdAndStatus(Long userId, Long showtimeId, Order.OrderStatus status);`
- **[`OrderService.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/OrderService.java)** & **[`OrderServiceImpl.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/Impl/OrderServiceImpl.java)**
  - Check for existing pending order before order creation; throw `DuplicatePendingOrderException` if found.
  - Published `bookingOutboxEventWriter.orderCreated(saved)` within order transaction.
  - Implemented `getOrdersByUserId(Long userId)`.
- **[`PaymentService.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/PaymentService.java)** & **[`PaymentServiceImpl.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/Impl/PaymentServiceImpl.java)**
  - Injected `HttpPaymentService`.
  - In `refundOrder(...)`: Computes proportional refund amount (`finalAmount * refundPercent / 100`), calls `httpPaymentService.executeOrderRefund(orderId, refundAmount, reason)` *before* releasing tickets and seats.
  - Implemented `applyExpiredPayment(Long orderId, Long userId, String reason)`: Releases held seats and cancels expired pending orders.
  - In `applyCompletedPayment(...)`: Bypasses `assertUserMatches` for counter anonymous orders (`Order.ANONYMOUS_USER_ID`), and calls `bookingOutboxEventWriter.emitLoyaltyPointsEarned` when `userId > 0L`.

#### 3. Messaging & Outbox Layer
- **[`BookingOutboxEventWriter.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/outbox/BookingOutboxEventWriter.java)**
  - Added `public void orderCreated(Order order)` writing `order.created` outbox events.
  - Added `public void emitLoyaltyPointsEarned(Long userId, Long orderId, BigDecimal amount)` writing `loyalty.points.earned` outbox events.
- **[`PaymentAmqpConfiguration.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/messaging/PaymentAmqpConfiguration.java)**
  - Declared queue `bookingPaymentExpiredQueue` (`booking.payment.expired.v1`).
  - Declared queue `bookingPaymentExpiredDeadLetterQueue` (`booking.payment.expired.v1.dlq`).
  - Added bindings to exchange with routing key `order.expired`.
- **[`PaymentEventEnvelopeReader.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/messaging/PaymentEventEnvelopeReader.java)**
  - Added `expiredPayload(JsonNode payload)` parser method.
- **[`PaymentEventMessageHandler.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/messaging/PaymentEventMessageHandler.java)**
  - Added `@RabbitListener(queues = "${booking.messaging.payment-events.expired-queue:booking.payment.expired.v1}")` consuming `consumeExpired`.
- **[`PaymentEventProcessor.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/messaging/PaymentEventProcessor.java)**
  - Added constant `EXPIRED = "order.expired"`.
  - Handled `EXPIRED` in idempotency check and switch-statement delegation to `paymentService.applyExpiredPayment(...)`.

#### 4. Configuration & Deployment
- **[`application.yml`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/resources/application.yml)**
  - Added `services.payment.url: ${PAYMENT_SERVICE_URL:http://localhost:5003}`.
  - Adjusted `outbox.dispatcher.fixed-delay-ms: ${OUTBOX_DISPATCHER_FIXED_DELAY_MS:500}` for lower event publish latency.
  - Added `booking.messaging.payment-events.expired-queue: ${BOOKING_PAYMENT_EXPIRED_QUEUE:booking.payment.expired.v1}`.
- **[`infrastructure/docker-compose.yml`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/infrastructure/docker-compose.yml)**
  - Injected `PAYMENT_SERVICE_URL: http://payment-service:80` environment variable into the `booking-service` container definition.

#### 5. Unit & Integration Test Updates
- **[`OrderServiceImplTest.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/test/java/com/uit/cinema/booking/service/OrderServiceImplTest.java)**
  - Added mock verification for `bookingOutboxEventWriter.orderCreated(...)`.
  - Added test `createOrder_whenDuplicatePendingOrder_throwsDuplicatePendingOrderException()`.
- **[`PaymentServiceImplTest.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/test/java/com/uit/cinema/booking/service/Impl/PaymentServiceImplTest.java)** & **[`service/PaymentServiceImplTest.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/test/java/com/uit/cinema/booking/service/PaymentServiceImplTest.java)**
  - Mocked `HttpPaymentService`.
  - Verified `httpPaymentService.executeOrderRefund(...)` calls with correct calculated amounts (100% vs 50%).
  - Added test `applyCompletedPayment_counterOrderAnonymous_bypassesUserMismatch()` verifying anonymous counter orders bypass user validation.

---

## 4. Inter-Service Communication Flow Diagrams

### Flow 1: Order Refund Flow
```
User / Portal                  Booking-Service                       Payment-Service
      │                              │                                      │
      │  POST /api/orders/{id}/refund│                                      │
      ├─────────────────────────────►│                                      │
      │                              │ Calculate refund % (e.g. 50%)        │
      │                              │ Calculate refundAmount               │
      │                              │                                      │
      │                              │ POST /api/payments/order/{id}/refund │
      │                              ├─────────────────────────────────────►│
      │                              │ (X-Internal-Token header)            │ Execute Stripe/VNPay refund
      │                              │◄─────────────────────────────────────┤ 200 OK
      │                              │                                      │
      │                              │ Set Tickets -> REFUNDED              │
      │                              │ Release Seats                        │
      │                              │ Set Order -> REFUNDED                │
      │                              │ Publish outbox: order.refunded       │
      │◄─────────────────────────────┤                                      │
      │   200 OK (Refunded Order)    │                                      │
```

### Flow 2: Duplicate Pending Order Rejection
```
User / Portal                  Booking-Service                       Database
      │                              │                                   │
      │  POST /api/orders            │                                   │
      ├─────────────────────────────►│ existsByUserIdAndShowtimeId...    │
      │                              ├──────────────────────────────────►│
      │                              │◄──────────────────────────────────┤ Returns true (Order #777)
      │                              │                                   │
      │◄─────────────────────────────┤ Throws DuplicatePendingOrderException
      │   409 Conflict               │
      │   existingOrderId: 777       │
```

### Flow 3: Order Expiration via RabbitMQ
```
Payment-Service (Cron/Saga)          RabbitMQ                  Booking-Service
            │                           │                             │
            │ order.expired             │                             │
            ├──────────────────────────►│                             │
            │                           │ Deliver to                  │
            │                           │ booking.payment.expired.v1  │
            │                           ├────────────────────────────►│
            │                           │                             │ PaymentEventProcessor
            │                           │                             │ ├─ Check idempotency
            │                           │                             │ ├─ Release held seats
            │                           │                             │ └─ Set Order -> CANCELLED
            │                           │◄────────────────────────────┤ ACK message
```

### Flow 4: Staff Counter Cash Payment Settlement & Loyalty Points Flow
```
Staff Counter POS              Payment-Service (Saga)          RabbitMQ                  Booking-Service
      │                              │                            │                             │
      │ POST /api/payments/initiate  │                            │                             │
      │ (method=CASH, role=STAFF)    │                            │                             │
      ├─────────────────────────────►│                            │                             │
      │                              │ 1. Complete immediately    │                             │
      │                              │ 2. Generate CASH-TxnId     │                             │
      │                              │ 3. Transition -> Completed │                             │
      │                              │ 4. Emit payment.completed  │                             │
      │                              ├───────────────────────────►│                             │
      │◄─────────────────────────────┤                            │                             │
      │ 200 OK (CASH completed)      │                            │ Deliver to                  │
      │                              │                            │ booking.payment.completed.v1│
      │                              │                            ├────────────────────────────►│
      │                              │                            │                             │ 1. Bypass user match (if anonymous)
      │                              │                            │                             │ 2. Set Order -> PAID
      │                              │                            │                             │ 3. Generate tickets
      │                              │                            │                             │ 4. Outbox: loyalty.points.earned (if member)
      │                              │                            │◄────────────────────────────┤ ACK message
```

---

## 5. Verification & Test Run Results

The Spring Boot test suite was executed and fully verified:
```bash
cd cinema-booking-system/backend/services/booking-service
mvn test
```

### Test Execution Summary:
- **Total Tests Run**: 76
- **Failures**: 0
- **Errors**: 0
- **Skipped**: 0
- **Build Status**: `BUILD SUCCESS` (Total time: ~26s)

---

## 6. Recommendations for Spring Boot Maintainer
1. **Circuit Breaker / Timeout**: Consider wrapping `HttpPaymentService.executeOrderRefund` in a Resilience4j circuit breaker or retry mechanism with appropriate HTTP timeouts (currently defaults to standard RestClient timeouts).
2. **Database Migration**: Ensure the database indices support querying `(user_id, showtime_id, status)` if order volume grows significantly.
3. **Queue Topology**: Ensure RabbitMQ has the exchange `cinema.events` (or configured exchange) created in test environments before starting the services.
