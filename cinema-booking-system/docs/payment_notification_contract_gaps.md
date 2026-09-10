# Payment / Notification Contract Gaps (Spring Booking consumer)

Date: 2026-08-18  
Audience: ASP.NET Payment, Notification, and Keycloak collaborators  
Spring change: `booking-service` now consumes `payment.completed`, `payment.failed`, and `payment.refunded`. **No ASP.NET sources were modified.**

Consumer contract: [`backend/shared/events/payment-events.md`](../backend/shared/events/payment-events.md)

---

## 1. What Booking implemented

| Item | Detail |
|---|---|
| Queues (Booking-owned) | `booking.payment.completed.v1`, `booking.payment.failed.v1`, `booking.payment.refunded.v1` plus `.dlq` |
| Exchange | `payment.events` (topic) |
| Routing keys | `payment.completed`, `payment.failed`, `payment.refunded` |
| Idempotency | Table `booking_processed_payment_events` keyed by envelope `eventId` |
| Flag | `BOOKING_PAYMENT_EVENTS_ENABLED` (Compose booking-service = `true`) |
| Retry | 3 attempts, 1s × 2 backoff, then reject-without-requeue → DLQ (`cinema.events.dlx`) |
| HTTP fallback | `POST /api/orders/{id}/pay` and `/refund` remain; they are not removed |

State matrix:

| Event | PENDING | PAID | CANCELLED | REFUNDED |
|---|---|---|---|---|
| completed | seats BOOKED, tickets, `order.paid` | no-op | ignore stale | ignore stale |
| failed | release hold, CANCELLED | ignore (do not unbook) | no-op | ignore |
| refunded | ignore | refund seats/tickets, `order.refunded` (no time window) | ignore | no-op |

---

## 2. Payment Service — blocking publish topology

Severity: **breaking for live integration** until confirmed.

MassTransit `Publish<EventEnvelope<T>>` still uses the default message-type exchange unless an `EntityNameFormatter` maps it to `payment.events`. Booking **only** binds:

```
payment.events  --payment.completed--> booking.payment.completed.v1
payment.events  --payment.failed----> booking.payment.failed.v1
payment.events  --payment.refunded--> booking.payment.refunded.v1
```

It will **not** bind CLR type-name exchanges such as
`PaymentService.Application.Contracts:EventEnvelope\`1[[...PaymentCompleted]]`.

### Requested Payment change (do not require Booking to follow MassTransit names)

1. Publish the three envelopes to exchange `payment.events` with the routing keys above.
2. Use raw JSON matching the shared envelope (`eventId`, `eventType`, `occurredAt`, `schemaVersion`, `source`, `payload`) in **camelCase**.
3. Set `source` to `payment-service` and `schemaVersion` to `1`.
4. `occurredAt` / `paidAt` as RFC-3339 with offset (`...Z`).

`UseRawJsonSerializer()` is necessary but not sufficient if the publish exchange name is still the CLR type.

---

## 3. Payment Service — producer-owned queues

Severity: **operational leak**.

Payment currently `BindQueue`s:

| Payment-created queue | Routing key | DLQ args |
|---|---|---|
| `booking.payment.completed` | `payment.completed` | none |
| `booking.payment.failed` | `payment.failed` | none |
| `booking.refund.completed` | `payment.refunded` | none |

Booking does **not** consume those queues. If they stay bound to `payment.events`, they accumulate unread copies of every payment event.

**Ask:** stop binding queues from the Payment publish topology. Consumers own queues. If you keep a temporary bind, use the `*.v1` names only after agreeing DLQ arguments (`x-dead-letter-exchange=cinema.events.dlx`). Redeclaring the same queue with different args will fail with `PRECONDITION_FAILED`.

Refund queue name mismatch: Payment uses `booking.refund.completed`; Booking uses `booking.payment.refunded.v1`. Harmless if Booking owns the v1 queue.

---

## 4. Missing / extra payload fields

| Field | Status | Booking behavior |
|---|---|---|
| `orderId` | required | reject if missing |
| `userId` | present on Payment records | if present and ≠ `orders.user_id` → poison/DLQ |
| `paymentId`, `correlationId`, `transactionId`, `paymentMethod`, `reason` | used when present | |
| `amount` / `refundAmount` | present | mismatch vs `finalAmount` is a **warning only** |
| `currency` | **missing** vs migration handoff | not applied |
| `order.cancelled` event | **not produced** by Booking on payment failure | Notification cannot key off it |

`OrderPaid` (Booking → Payment) is still published after a successful completed-event apply. Payment's `OrderPaidConsumer` is a no-op log. Safe, unused.

---

## 5. Semantic gaps (Booking will not guess)

1. **Completed after cancel.** If the hold expired / order is `CANCELLED` and then `payment.completed` arrives, Booking ignores it. Payment must compensate (refund the capture). No Spring callback is sent.
2. **Failed after paid.** Ignored. Do not publish `payment.failed` after a completed capture unless you intend it as a no-op.
3. **Refund of checked-in tickets.** Booking dead-letters the message. Payment has already refunded money; ops must reconcile.
4. **Missing order.** Booking retries then DLQ. Create the PENDING order before initiating payment.
5. **HTTP `/pay` vs saga.** Both paths can mark an order paid. Duplicate `eventId` is safe; two different payments for one order are not. Freeze “initiate payment only for PENDING orders” on the Payment side.

---

## 6. Notification Service — not implemented

There is no Notification consumer in this repository (placeholder folder only).

| Event | Expected Notification action | Producer |
|---|---|---|
| `order.paid` | booking confirmation / tickets | Booking outbox |
| `order.refunded` | refund confirmation | Booking outbox |
| `payment.completed` | payment receipt (optional duplicate of order.paid) | Payment |
| `payment.failed` | payment failure / retry instructions | Payment |
| `payment.refunded` | refund receipt (optional duplicate of order.refunded) | Payment |

Notification should bind its **own** `notification.*.v1` queues to `booking.events` and `payment.events`. Do not share Booking’s v1 queues.

There is **no** `order.cancelled` routing key today.

---

## 7. Local verification (after Keycloak RabbitMQ SPI)

SPI source (Java Keycloak extension, not ASP.NET):
`cinema-booking-system/backend/infrastructure/keycloak-spi/`

### 7.1 Build and install the SPI

```powershell
cd cinema-booking-system\backend\infrastructure\keycloak-spi
mvn -q -DskipTests package
# Copy target/rabbitmq-event-listener-1.0.0.jar into the Keycloak providers directory
# Restart Keycloak and enable the event listener on the cinema realm
```

SPI publishes to topic exchange `user.events`. Confirm with a registration:

- `user.registered` (and delete / password-reset if those cases are enabled)
- Identity mapping Keycloak `sub` → numeric `user_id` must exist before Booking/Payment use `userId`

### 7.2 Start the Spring booking consumer

```powershell
cd cinema-booking-system\backend
docker compose -f infrastructure\docker-compose.yml up -d rabbitmq postgres showtime-redis
# then booking-service (Compose sets BOOKING_PAYMENT_EVENTS_ENABLED=true)
```

RabbitMQ management (`http://localhost:15672`, user `cinema`):

- Exchange `payment.events` (topic)
- Queues `booking.payment.completed.v1`, `.failed.v1`, `.refunded.v1` and matching `.dlq`

### 7.3 Happy path (do **not** call Booking `POST /api/orders/{id}/pay`)

1. Authenticate through Gateway/Keycloak so the token carries numeric `user_id`.
2. Hold seats + create a `PENDING` order in Booking.
3. Initiate and complete payment in Payment Service (Stripe/PayPal/cash).
4. Expect:
   - order `PAID`, tickets `VALID`, seats BOOKED
   - Booking outbox `order.paid`
   - row in `booking_processed_payment_events`
5. Publish the **same** envelope `eventId` again → no second ticket.

### 7.4 Failure / refund / poison

| Publish | Expect |
|---|---|
| `payment.failed` on PENDING | order `CANCELLED`, hold released |
| `payment.failed` on already PAID | order stays `PAID` |
| `payment.refunded` on PAID (even inside 4h window) | tickets `REFUNDED`, `order.refunded` outbox |
| body `{not-json}` or `schemaVersion: 2` | after 3 retries, message on the matching `.dlq` |
| `userId` ≠ order owner | DLQ |

### 7.5 Maven check (no broker required)

```powershell
cd cinema-booking-system\backend
mvn -pl services/booking-service test
```

---

## 8. Out of scope on purpose

- No edits under `services/payment-service`, `identity-service`, `api-gateway`, `notification-service`, or ASP.NET Facility.
- No MassTransit exchange-name workaround inside Booking.
- No removal of Booking’s HTTP pay/refund endpoints in this change.
