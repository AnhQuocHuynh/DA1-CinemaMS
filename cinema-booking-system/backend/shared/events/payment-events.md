# Payment Events (Booking consumer contract)

Status: version 1. `booking-service` consumes these messages when
`BOOKING_PAYMENT_EVENTS_ENABLED=true`. Payment Service (ASP.NET) is the
producer; this file is the Spring consumer contract.

All messages use the common [event envelope](README.md#envelope).
`source` must be `payment-service`. `schemaVersion` must be `1`.
Consumers deduplicate on `eventId`.

## Routing

| Event type | Exchange | Routing key | Booking queue | DLQ |
|---|---|---|---|---|
| `payment.completed` | `payment.events` (topic) | `payment.completed` | `booking.payment.completed.v1` | `booking.payment.completed.v1.dlq` |
| `payment.failed` | `payment.events` | `payment.failed` | `booking.payment.failed.v1` | `booking.payment.failed.v1.dlq` |
| `payment.refunded` | `payment.events` | `payment.refunded` | `booking.payment.refunded.v1` | `booking.payment.refunded.v1.dlq` |

Booking owns the `*.v1` queues and binds them itself. Dead letters go to
`cinema.events.dlx` with the original queue name as routing key.

## `payment.completed`

```json
{
  "eventId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "eventType": "payment.completed",
  "occurredAt": "2026-08-20T12:00:00Z",
  "schemaVersion": 1,
  "source": "payment-service",
  "payload": {
    "correlationId": "d4e5f6a7-b8c9-0123-def0-123456789abc",
    "paymentId": 42,
    "orderId": 101,
    "userId": 7,
    "amount": 350000.00,
    "transactionId": "txn_stripe_abc123",
    "paymentMethod": "STRIPE",
    "paidAt": "2026-08-20T12:00:00Z"
  }
}
```

Required payload field: `orderId`. Booking confirms held seats, generates
tickets, marks the order `PAID`, and appends `order.paid` to its outbox.
Already-`PAID` orders are no-ops. `CANCELLED` / `REFUNDED` orders are ignored
as stale. Missing orders are retried, then dead-lettered.

## `payment.failed`

```json
{
  "eventId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "eventType": "payment.failed",
  "occurredAt": "2026-08-20T12:05:00Z",
  "schemaVersion": 1,
  "source": "payment-service",
  "payload": {
    "correlationId": "e5f6a7b8-c9d0-1234-ef01-23456789abcd",
    "paymentId": 43,
    "orderId": 102,
    "userId": 8,
    "reason": "Card declined by issuer"
  }
}
```

On a `PENDING` order, Booking releases the Redis hold and sets `CANCELLED`.
It does not emit `order.cancelled`. A failure after the order is already
`PAID` is ignored so a late failure cannot unbook a successful payment.

## `payment.refunded`

```json
{
  "eventId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "eventType": "payment.refunded",
  "occurredAt": "2026-08-20T13:00:00Z",
  "schemaVersion": 1,
  "source": "payment-service",
  "payload": {
    "correlationId": "f6a7b8c9-d0e1-2345-f012-3456789abcde",
    "paymentId": 42,
    "orderId": 101,
    "userId": 7,
    "refundAmount": 350000.00,
    "reason": "Customer requested refund"
  }
}
```

On a `PAID` order, Booking refunds tickets and seats **without** applying the
HTTP refund time window (the money has already moved). Checked-in tickets are
a poison message and go to the DLQ. Already-`REFUNDED` is a no-op.

## Delivery rules

- JSON object body. Field names should be camelCase; Booking also accepts PascalCase.
- `occurredAt` should be RFC-3339 with a timezone offset (`Z` preferred).
- If payload `userId` is present and does not match `orders.user_id`, the
  message is rejected as poison.
- If `amount` / `refundAmount` differs from `orders.final_amount`, Booking logs
  a warning and still applies the state change.
- At-least-once delivery: persist `eventId` in `booking_processed_payment_events`
  in the same transaction as the domain write.
