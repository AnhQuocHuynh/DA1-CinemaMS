# Event Contracts

These contracts define the versioned messages exchanged through RabbitMQ after the transactional outbox is enabled.

## Envelope

Every message is JSON and has this shape:

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "order.paid",
  "occurredAt": "2026-07-10T12:00:00Z",
  "schemaVersion": 1,
  "source": "booking-service",
  "payload": {}
}
```

`eventId` is the consumer idempotency key. Consumers must persist it before applying a projection and safely ignore redeliveries. Producers must only add fields in a backward-compatible schema version; incompatible changes require a new version and routing key.

## Routing

| Producer | Exchange | Routing keys | Consumers |
|---|---|---|---|
| Catalog | `catalog.events` | `movie.created`, `movie.updated`, `movie.deleted` | Analytics, Recommendation |
| Booking | `booking.events` | `order.paid`, `order.refunded`, `review.created` | Analytics, Recommendation, Notification |

The transactional outbox stores both exchange and routing key. It is the dispatcher, not the domain transaction, that talks to RabbitMQ. Catalog and Booking now have opt-in relays that lock pending rows, retry failures with exponential backoff, and move rows to `FAILED` after ten failed attempts. Delivery is at-least-once, so duplicate handling by `eventId` remains mandatory.

## Consumer Progress

`analytics-service` now has an idempotent projection component for `order.paid`,
`order.refunded`, and movie lifecycle events. It is deliberately not an HTTP
endpoint and does not connect to RabbitMQ yet; the future AMQP listener must
delegate its decoded envelope to that component and acknowledge only after the
projection transaction commits.

## Contracts

- [Catalog events](catalog-events.md)
- [Booking events](booking-events.md)
