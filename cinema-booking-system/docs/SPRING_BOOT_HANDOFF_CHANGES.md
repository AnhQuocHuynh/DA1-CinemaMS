# Spring Boot Services Handoff: Changes & Architecture Documentation

## 1. Overview & Scope

This document provides a complete handover summary of all modifications, additions, and architectural improvements made to the Spring Boot microservices (**`booking-service`** and **`showtime-service`**), explaining **what changed**, **how the flow behaved before the change**, and **how the cross-service Saga behaves now**.

### Services Affected
- **`booking-service`** (Java 21, Spring Boot 3.3.x): Order creation seat diffing, post-payment async Saga compensation, dynamic customer refund tiers, staff counter booking, outbox event dispatching, and RabbitMQ payment consumers.
- **`showtime-service`** (Java 21, Spring Boot 3.3.x): Fallback soft-lock seat confirmation when payment completes after Redis hold TTL expiration.
- **`infrastructure/docker-compose.yml`**: Inter-service discovery configuration (`PAYMENT_SERVICE_URL`).

---

## 2. Latest Saga, Seat Retry & Compensation Changes (Before vs. After Impact)

### A. Post-Payment Seat Conflict Compensation (`booking-service` — [`PaymentServiceImpl.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/Impl/PaymentServiceImpl.java))

#### Flow Impact **Before** the Change:
1. **Uncompensated DLQ Drop (Original Behavior)**:
   - When `payment.completed` arrived from RabbitMQ after a user's seat hold expired and another customer took the seat (`SEAT_ALREADY_TAKEN`), `applyCompletedPayment` rethrew the `CustomException`.
   - `PaymentEventProcessor` treated `409 Conflict` as a non-retryable poison message, rolling back the transaction and routing `payment.completed` to `booking.payment.completed.v1.dlq`.
   - **Consequence**: The customer's card/PayPal was charged, no tickets were issued, the order remained stuck in `PENDING`, and no refund was ever triggered.
2. **Mixed Sync-HTTP + Async-Outbox Collision (Intermediate Behavior)**:
   - Calling `httpPaymentService.executeOrderRefund(...)` synchronously *while also* emitting `bookingOutboxEventWriter.orderCancelled(...)` inside `compensateSeatsUnavailableAfterPayment` (which runs inside a `@Transactional` RabbitMQ listener) caused three problems:
     - Held a PostgreSQL transaction open in `booking-service` across an HTTP call to `payment-service` and an external HTTPS refund call to Stripe/PayPal.
     - Because `order.cancelled` is written to the transactional outbox, the synchronous HTTP refund **always reached `payment-service` first** (before `booking-service` committed and flushed the outbox). Once `payment-service` also listened to `order.cancelled`, the async event arrived second and either triggered a duplicate refund or failed with `InvalidPaymentStateException` (`409 Conflict`).
     - If the gateway refund succeeded in `payment-service` (`Payment.Status = REFUNDED`) but the HTTP response timed out before reaching `booking-service`, `booking-service` rolled back `Order.status = CANCELLED` and retried `payment.completed`. On retry, the synchronous HTTP refund returned `409 Conflict`, which `PaymentEventProcessor` treated as a poison message—rolling back the cancellation and dropping the message into the DLQ even though the refund had succeeded.

#### Flow Impact **After** the Change (100% Async Outbox + Saga):
- In [`PaymentServiceImpl.applyCompletedPayment`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/Impl/PaymentServiceImpl.java#L151-L194):
  - When `processPayment` throws `CustomException` with `errorCode == "SEAT_ALREADY_TAKEN"`, [`compensateSeatsUnavailableAfterPayment(Order order)`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/Impl/PaymentServiceImpl.java#L188-L194):
    1. Marks `order.setStatus(Order.OrderStatus.CANCELLED)` and saves the order.
    2. Appends `order.cancelled` (`reason = "SEATS_UNAVAILABLE_AFTER_PAYMENT"`) to the local transactional outbox via [`bookingOutboxEventWriter.orderCancelled(...)`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/outbox/BookingOutboxEventWriter.java#L112-L125).
    3. Commits immediately and returns `PaymentEventOutcome.APPLIED` (**no synchronous HTTP call inside the consumer**).
- Downstream in `payment-service`:
  - `OrderCancelledConsumer` receives `order.cancelled` from the `booking.events` exchange, checks if `Payment.Status == COMPLETED` (ignoring unpaid/expired cancellations or already-refunded payments idempotently), executes the Stripe/PayPal refund via `ExecuteOrderRefundCommand`, transitions `PaymentStateMachine` from `Completed -> Refunded`, and emits `payment.refunded`.
- Follow-up in `booking-service`:
  - When `payment.refunded` arrives back at [`PaymentServiceImpl.applyRefundedPayment`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/Impl/PaymentServiceImpl.java#L229-L248), `order.getStatus()` is already `CANCELLED`, so `applyRefundedPayment` safely logs and returns `PaymentEventOutcome.IGNORED_STALE` without touching tickets or releasing seats owned by another customer.
- *(Note: Synchronous `httpPaymentService.executeOrderRefund(...)` is preserved exclusively in [`PaymentServiceImpl.refund`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/Impl/PaymentServiceImpl.java#L106-L147) for user-initiated REST refunds on `PAID` orders where the caller awaits an immediate HTTP response before booked seats are released.)*

---

### B. Fallback Seat Confirmation After Hold Expiration (`showtime-service` — [`SeatReservationServiceImpl.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/showtime-service/src/main/java/com/uit/cinema/showtime/service/SeatReservationServiceImpl.java))

#### Flow Impact **Before** the Change:
- `confirmHeldSeats` strictly required `seat.getStatus() == ShowtimeSeat.SeatStatus.HELD` and an active Redis hold key owned by `request.userId()`.
- If a payment gateway webhook was delayed slightly past the 10-minute Redis seat hold TTL—**even when the seats were still completely free (`AVAILABLE` / untouched by anyone else)**—`confirmHeldSeats` rejected the confirmation with `SEAT_NOT_HELD` / `SEAT_HOLD_EXPIRED`.

#### Flow Impact **After** the Change:
- In [`SeatReservationServiceImpl.confirmHeldSeats`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/showtime-service/src/main/java/com/uit/cinema/showtime/service/SeatReservationServiceImpl.java#L74-L107):
  - If a seat is already `BOOKED` in DB or actively held in Redis by a different user (`!requesterId.equals(String.valueOf(holder))`), it immediately throws `409 Conflict` with error code `SEAT_ALREADY_TAKEN` ([`seatAlreadyTaken`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/showtime-service/src/main/java/com/uit/cinema/showtime/service/SeatReservationServiceImpl.java#L289-L291)).
  - If the Redis hold key has expired (`holder == null`) and the seat is not `BOOKED`, [`softLockExpiredHolds`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/showtime-service/src/main/java/com/uit/cinema/showtime/service/SeatReservationServiceImpl.java#L275-L287) atomically re-claims the Redis key via `setIfAbsent(key, requesterId, SeatHoldPolicy.HOLD_TTL)` and confirms the seat as `BOOKED`.
  - If another user grabs any of the expired seats concurrently (`setIfAbsent` returns `false`), all temporary claims made during `softLockExpiredHolds` are rolled back and `SEAT_ALREADY_TAKEN` is thrown, triggering the async refund compensation in `booking-service`.

---

### C. Seat Selection Diffing & Superseding Stale Pending Orders (`booking-service` — [`OrderServiceImpl.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/Impl/OrderServiceImpl.java))

#### Flow Impact **Before** the Change:
- `OrderServiceImpl.createOrder` checked `existsByUserIdAndShowtimeIdAndStatus(userId, showtimeId, PENDING)` without inspecting which seats were in the existing pending order.
- If a user selected seats `A1, A2`, reached Checkout (creating Pending Order `#100`), clicked "Back" to the seat map, changed their selection to `B5, B6`, and clicked "Pay" again:
  - `booking-service` threw HTTP `409 DUPLICATE_PENDING_ORDER` returning `existingOrderId = 100`.
  - The frontend adopted Order `#100`, causing the user to pay for the old seats (`A1, A2`) instead of `B5, B6`.

#### Flow Impact **After** the Change:
- In [`OrderServiceImpl.createOrder`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/Impl/OrderServiceImpl.java#L44-L93):
  - Looks up `existingPending = orderRepository.findByUserIdAndShowtimeIdAndStatus(userId, showtimeId, PENDING)`.
  - **Same Seats (`hasSameSeats == true`)**: Throws `DuplicatePendingOrderException(existingPending.get().getId())` so a true retry resumes the existing order.
  - **Different Seats (`hasSameSeats == false`)**:
    1. First validates that the newly requested `seatIds` are validly held by the user (`seatReservationService.validateHeldSeats`). If validation fails, the existing pending order is left untouched.
    2. Once new seats are validated, [`cancelSupersededOrder`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/Impl/OrderServiceImpl.java#L158-L172) marks the old order `CANCELLED`, decrements any voucher `usedCount` ([`restoreVoucherUsage`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/Impl/OrderServiceImpl.java#L174-L180)), emits `order.cancelled` (`reason = "SEATS_CHANGED"`), and best-effort releases any deselected seats still held by the user ([`releaseSeatIfStillHeldByUser`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/Impl/OrderServiceImpl.java#L186-L194)).
    3. Creates and saves the new `PENDING` order for the new seats and emits `order.created`.

---

## 3. Earlier Features & Architectural Additions

### D. Dynamic Refund Calculation & Synchronous Customer-Initiated Gateway Refund
- **Showtime-Aware Refund Tiers** ([`PaymentServiceImpl.refund`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/Impl/PaymentServiceImpl.java#L106-L147)):
  - `> 24 hours` before showtime: **100% refund**.
  - `4 hours to 24 hours` before showtime: **50% refund**.
  - `< 4 hours` before showtime: **0% (Non-refundable, throws `REFUND_WINDOW_CLOSED`)**.
  - Disallowed if any ticket is marked `CHECKED_IN` (`TICKET_ALREADY_CHECKED_IN`).
- **REST Client Integration ([`HttpPaymentService.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/client/HttpPaymentService.java))**:
  - Synchronously invokes `POST /api/payments/order/{orderId}/refund` on `payment-service` during customer-initiated refunds (`PaymentServiceImpl.refund`) *before* marking tickets `REFUNDED` and releasing booked seats.
- **Real-Time Refund Metadata in [`OrderResponse`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/dto/response/OrderResponse.java)**:
  - `refundable` (`boolean`) and `refundPercent` (`int`) computed dynamically in [`OrderResponseMapper.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/mapper/OrderResponseMapper.java) whenever order status is `PAID`.

### E. Outbox Event Publication on Order Creation (`order.created`) & Loyalty Points (`loyalty.points.earned`)
- [`BookingOutboxEventWriter.orderCreated(Order order)`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/outbox/BookingOutboxEventWriter.java#L22-L37): Emits `order.created` to `booking.events` so `payment-service` pre-reserves a payment slot and initializes `PaymentSagaState` in `Created`.
- [`BookingOutboxEventWriter.emitLoyaltyPointsEarned(...)`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/outbox/BookingOutboxEventWriter.java#L97-L110): Emits `loyalty.points.earned` when an order is marked `PAID` for authenticated members (`userId > 0L`).

### F. Expired Order Event Handling (`order.expired`)
- Configured queue `booking.payment.expired.v1` (and DLQ `booking.payment.expired.v1.dlq`) bound to `order.expired` in [`PaymentAmqpConfiguration.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/messaging/PaymentAmqpConfiguration.java).
- [`PaymentServiceImpl.applyExpiredPayment`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/Impl/PaymentServiceImpl.java#L276-L301) releases held seats, sets `Order.status = CANCELLED`, and emits `order.cancelled`.

### G. Staff Counter Booking, Anonymous Walk-In Support & Operational Dashboard
- **Anonymous Walk-In Support**: Added `Order.ANONYMOUS_USER_ID = 0L` and bypassed `assertUserMatches` in [`PaymentServiceImpl.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/Impl/PaymentServiceImpl.java#L303-L316) when `salesChannel == COUNTER` and `userId == 0L`.
- **Dedicated Staff API Surface ([`StaffBookingController.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/controller/StaffBookingController.java) & [`StaffBookingServiceImpl.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/Impl/StaffBookingServiceImpl.java))**:
  - `POST /api/staff/bookings`: Direct counter booking with compensating `releaseBookedSeats` rollback if order/ticket persistence fails.
  - `GET /api/staff/dashboard/summary`, `/bookings/today`, `/validation/stats`, and `/validation/bookings`.

### H. Downstream Error Propagation (`HttpSeatReservationService`) & Argument Type Mismatch Handling
- [`HttpSeatReservationService.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/client/HttpSeatReservationService.java): Preserves downstream 4xx status codes and error codes (such as `409 Conflict` / `SEAT_ALREADY_TAKEN`) instead of masking them as `503 SERVICE_UNAVAILABLE`.
- [`GlobalExceptionHandler.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/core/exception/GlobalExceptionHandler.java): Handles `DuplicatePendingOrderException` (`409 Conflict`) and `MethodArgumentTypeMismatchException` (`400 Bad Request`).

---

## 4. End-to-End Flow Diagrams (Before vs. After)

### Flow 1: Post-Payment Seat Conflict Compensation (Before vs. After)

#### ❌ Before (Mixed Sync HTTP + Async Outbox inside `@Transactional` Consumer):
```text
Payment-Service               RabbitMQ                Booking-Service (@Transactional)
       │                         │                                  │
       │ 1. payment.completed    │                                  │
       ├────────────────────────►├─────────────────────────────────►│
       │                         │                                  │ confirmHeldSeats() -> SEAT_ALREADY_TAKEN
       │                         │                                  │ Order.status = CANCELLED
       │                         │                                  │ Outbox.append(order.cancelled) [Not yet committed]
       │                         │                                  │
       │      2. Sync HTTP POST /api/payments/order/{id}/refund     │
       │◄───────────────────────────────────────────────────────────┤ (DB transaction held open during Stripe/PayPal call)
       │ Payment.Status = REFUNDED                                  │
       │ (Saga still stuck in Completed!)                           │
       ├───────────────────────────────────────────────────────────►│ 200 OK (or if timeout -> retry -> 409 Conflict -> DLQ!)
       │                         │                                  │ Commit DB & flush Outbox
       │                         │ 3. Publish order.cancelled       │
       │                         │◄─────────────────────────────────┤
       │◄────────────────────────┤                                  │
       │ 4. Receives order.cancelled after HTTP refund already ran! │
       │    -> Risk of double refund or 409 InvalidPaymentState     │
```

#### ✅ After (100% Async Outbox + Saga Compensation):
```text
Payment-Service (Saga)        RabbitMQ                Booking-Service (@Transactional)
       │                         │                                  │
       │ 1. payment.completed    │                                  │
       ├────────────────────────►├─────────────────────────────────►│
       │                         │                                  │ confirmHeldSeats() -> SEAT_ALREADY_TAKEN
       │                         │                                  │ Order.status = CANCELLED
       │                         │                                  │ Outbox.append(order.cancelled,
       │                         │                                  │   reason="SEATS_UNAVAILABLE_AFTER_PAYMENT")
       │                         │                                  │ Commit DB immediately & ACK
       │                         │ 2. Publish order.cancelled       │
       │                         │◄─────────────────────────────────┤
       │◄────────────────────────┤                                  │
       │ 3. OrderCancelledConsumer                                  │
       │    ├─ Check Payment.Status == COMPLETED (idempotent guard) │
       │    ├─ Execute Stripe/PayPal Refund                         │
       │    ├─ Payment.MarkAsRefunded()                             │
       │    └─ Publish RefundRequested -> Saga: Completed -> Refunded│
       │ 4. Emit payment.refunded│                                  │
       ├────────────────────────►├─────────────────────────────────►│
       │                         │                                  │ applyRefundedPayment()
       │                         │                                  │ └─ Order is CANCELLED -> IGNORED_STALE (safe no-op)
```

---

## 5. Summary of Modified & Added Files in Spring Boot Services

| Service | File Path | Summary of Change |
| :--- | :--- | :--- |
| `booking-service` | [`PaymentServiceImpl.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/Impl/PaymentServiceImpl.java) | Removed sync `httpPaymentService.executeOrderRefund` from `compensateSeatsUnavailableAfterPayment`; relies strictly on atomic `Order.status = CANCELLED` + outbox `order.cancelled` (`SEATS_UNAVAILABLE_AFTER_PAYMENT`). |
| `booking-service` | [`OrderServiceImpl.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/service/Impl/OrderServiceImpl.java) | Added seat diffing (`hasSameSeats`) in `createOrder`: throws `DuplicatePendingOrderException` if seats match, or supersedes the old pending order (`cancelSupersededOrder`, voucher restore, `order.cancelled` with `SEATS_CHANGED`, seat release) if seats changed. |
| `booking-service` | [`BookingOutboxEventWriter.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/outbox/BookingOutboxEventWriter.java) | Publishes `order.created`, `order.paid`, `order.refunded`, `order.cancelled`, and `loyalty.points.earned` to `booking.events`. |
| `booking-service` | [`PaymentServiceImplTest.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/test/java/com/uit/cinema/booking/service/PaymentServiceImplTest.java) | Updated & expanded unit tests for async `SEAT_ALREADY_TAKEN` compensation, stale `payment.completed` / `payment.refunded` idempotency on `CANCELLED` orders, and anonymous counter compensation. |
| `booking-service` | [`BookingOutboxEventWriterTest.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/test/java/com/uit/cinema/booking/outbox/BookingOutboxEventWriterTest.java) | Added unit test suite verifying `order.cancelled` JSON envelope contract (`orderId`, `userId`, `reason`) and outbox persistence. |
| `booking-service` | [`OrderServiceImplTest.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/test/java/com/uit/cinema/booking/service/OrderServiceImplTest.java) | Unit tests covering same-seat `DuplicatePendingOrderException` vs. different-seat order superseding and voucher restoration. |
| `showtime-service` | [`SeatReservationServiceImpl.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/showtime-service/src/main/java/com/uit/cinema/showtime/service/SeatReservationServiceImpl.java) | Updated `confirmHeldSeats` with `softLockExpiredHolds` fallback confirmation when Redis hold expires but seat is still available, and `SEAT_ALREADY_TAKEN` when taken by another user. |
| `showtime-service` | [`SeatReservationServiceImplTest.java`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/showtime-service/src/test/java/com/uit/cinema/showtime/service/SeatReservationServiceImplTest.java) | Unit tests verifying normal hold confirmation, fallback confirmation after Redis TTL expiry, and `SEAT_ALREADY_TAKEN` rollback on conflict. |

---

## 6. Verification & Test Run Results

```bash
mvn -f cinema-booking-system/backend/pom.xml -pl services/booking-service -Dtest="PaymentServiceImplTest,BookingOutboxEventWriterTest,PaymentEventProcessorTest,PaymentEventMessageHandlerTest,TransactionalOutboxTest,OutboxDispatcherTest" test
```

- **Tests Run**: 42 (across `PaymentServiceImplTest`, `BookingOutboxEventWriterTest`, `PaymentEventProcessorTest`, `PaymentEventMessageHandlerTest`, `TransactionalOutboxTest`, `OutboxDispatcherTest`)
- **Failures / Errors**: 0
- **Build Status**: `BUILD SUCCESS`
