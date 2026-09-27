# Booking status for teammate testing

Branch: `refactor-compose-single-postgres`  
Owner of this change: Spring `booking-service` only  
Do **not** look at `backend_legacy` for this test. Compose runs `backend/services/booking-service`.

## What to test after this Booking change is on the branch

Booking consumes Payment outcomes over RabbitMQ:

| Routing key | Booking queue | Expected order result |
|---|---|---|
| `payment.completed` | `booking.payment.completed.v1` | PENDING → PAID, tickets VALID, seats BOOKED, outbox `order.paid` |
| `payment.failed` | `booking.payment.failed.v1` | PENDING → CANCELLED, hold released |
| `payment.refunded` | `booking.payment.refunded.v1` | PAID → REFUNDED (no 4-hour HTTP window) |

Idempotency key: envelope `eventId`. Same event twice must not create a second ticket.

Flag: `BOOKING_PAYMENT_EVENTS_ENABLED=true` (already set on the booking-service Compose service).

## How to run

```powershell
cd cinema-booking-system\backend
docker compose -f infrastructure\docker-compose.yml up -d
```

1. RabbitMQ UI `http://localhost:15672` (user `cinema`): confirm the three `booking.payment.*.v1` queues and `.dlq`.
2. Hold seats, create a **PENDING** order through Gateway → Booking.
3. **Do not** call Booking `POST /api/orders/{id}/pay` for this saga test.
4. Complete / fail / refund in **Payment Service**.
5. Check Booking order, tickets, showtime seats, and `booking_processed_payment_events`.

HTTP `/pay` still exists as a fallback. Using it bypasses Payment and is not this test.

## If Booking does not move

Payment must publish a camelCase envelope to exchange **`payment.events`**:

```json
{
  "eventId": "uuid",
  "eventType": "payment.completed",
  "occurredAt": "2026-08-20T12:00:00Z",
  "schemaVersion": 1,
  "source": "payment-service",
  "payload": { "orderId": 101, "userId": 7, "transactionId": "txn_1", "paymentMethod": "STRIPE" }
}
```

Routing keys: `payment.completed`, `payment.failed`, `payment.refunded`.  
Booking does **not** bind MassTransit CLR type-name exchanges.

If payload `userId` is present and does not match `orders.user_id`, the message is dead-lettered.

Full gaps: [`payment_notification_contract_gaps.md`](payment_notification_contract_gaps.md)  
Consumer contract: [`../backend/shared/events/payment-events.md`](../backend/shared/events/payment-events.md)
