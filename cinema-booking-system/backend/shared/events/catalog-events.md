# Catalog Events

Status: version 1 contract. `catalog-service` records movie events in its transactional outbox. A RabbitMQ dispatcher is deliberately not enabled yet.

## Envelope

```json
{
  "eventId": "uuid",
  "eventType": "movie.created",
  "occurredAt": "2026-07-08T00:00:00Z",
  "schemaVersion": 1,
  "source": "catalog-service",
  "payload": {}
}
```

## Event Types

| Event type | When |
|---|---|
| `movie.created` | A movie is created. |
| `movie.updated` | Movie metadata, status, or genre links change. |
| `movie.deleted` | A movie is soft-deleted or disabled. |
| `genre.created` | A genre is created. |
| `genre.deleted` | A genre is deleted. |
| `event.created` | An event is created. |
| `event.deleted` | An event is soft-deleted or disabled. |

## Movie Payload

```json
{
  "movieId": 1,
  "title": "Inception",
  "durationMinutes": 148,
  "releaseDate": "2010-07-16",
  "ageRating": "PG-13",
  "language": "English",
  "active": true,
  "genreIds": [1, 2],
  "genreNames": ["Sci-Fi", "Thriller"],
  "posterUrl": "https://example.com/poster.jpg"
}
```

## Event Payload

```json
{
  "eventId": 10,
  "name": "Premiere Night",
  "startTime": "2026-07-20T19:00:00Z",
  "endTime": "2026-07-20T21:00:00Z",
  "venue": "Main Hall",
  "active": true
}
```

## Delivery Rules

- Emit events through the `catalog.events` exchange with the event type as the routing key.
- Record the envelope in the outbox within the catalog transaction before a dispatcher publishes it.
- Consumers must be idempotent by `eventId`.
- Deletions are logical domain changes; consumers should not assume hard database deletes.
