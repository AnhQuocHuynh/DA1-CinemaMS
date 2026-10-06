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

---

## 3. Comprehensive File Inventory

### New Files Created

| File Path | Description |
| :--- | :--- |
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

#### 3. Messaging & Outbox Layer
- **[`BookingOutboxEventWriter.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/outbox/BookingOutboxEventWriter.java)**
  - Added `public void orderCreated(Order order)` writing `order.created` outbox events.
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

---

## 5. Verification & Test Run Results

The Spring Boot test suite was executed and fully verified:
```bash
cd cinema-booking-system/backend/services/booking-service
mvn test
```

### Test Execution Summary:
- **Total Tests Run**: 71
- **Failures**: 0
- **Errors**: 0
- **Skipped**: 0
- **Build Status**: `BUILD SUCCESS` (Total time: ~15s)

---

## 6. Recommendations for Spring Boot Maintainer
1. **Circuit Breaker / Timeout**: Consider wrapping `HttpPaymentService.executeOrderRefund` in a Resilience4j circuit breaker or retry mechanism with appropriate HTTP timeouts (currently defaults to standard RestClient timeouts).
2. **Database Migration**: Ensure the database indices support querying `(user_id, showtime_id, status)` if order volume grows significantly.
3. **Queue Topology**: Ensure RabbitMQ has the exchange `cinema.events` (or configured exchange) created in test environments before starting the services.
