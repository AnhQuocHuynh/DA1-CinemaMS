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

Both producer relays require correlated publisher confirms and mandatory routing.
An outbox row is marked `PUBLISHED` only after a broker ACK and no returned
message; NACKs, unroutable messages, and confirmation timeouts stay on the
bounded retry path. Relay outcome counters are available through Actuator metrics.

## Consumer Progress

`analytics-service` consumes `order.paid`, `order.refunded`, and movie lifecycle
events through dedicated durable queues when `ANALYTICS_MESSAGING_ENABLED=true`.
It validates version 1 envelopes, delegates to an idempotent transactional
projection, retries transient listener failures, and dead-letters messages that
still fail. Messaging remains opt-in outside the extracted-service Compose stack.

`recommendation-service` consumes movie, paid/refunded order, and review events
through its own durable queues. Event receipts and graph mutations commit in one
Neo4j transaction. Order interaction timestamps prevent an older paid event from
recreating a watch after a newer refund has already been applied.

## Contracts

- [Catalog events](catalog-events.md)
- [Booking events](booking-events.md)
