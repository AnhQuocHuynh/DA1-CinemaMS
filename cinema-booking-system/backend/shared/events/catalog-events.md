# Catalog Events

Status: draft. These events are not emitted by `catalog-service` yet. They define the payload shape that downstream services should consume once the outbox/message broker is introduced.

## Envelope

```json
{
  "eventId": "uuid",
  "eventType": "catalog.movie.created",
  "occurredAt": "2026-07-08T00:00:00Z",
  "schemaVersion": 1,
  "source": "catalog-service",
  "payload": {}
}
```

## Event Types

| Event type | When |
|---|---|
| `catalog.movie.created` | A movie is created. |
| `catalog.movie.updated` | Movie metadata, status, or genre links change. |
| `catalog.movie.deleted` | A movie is soft-deleted or disabled. |
| `catalog.genre.created` | A genre is created. |
| `catalog.genre.deleted` | A genre is deleted. |
| `catalog.event.created` | An event is created. |
| `catalog.event.deleted` | An event is soft-deleted or disabled. |

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
  "genreIds": [1, 2]
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

- Emit events after the catalog transaction commits.
- Use an outbox table before introducing RabbitMQ to prevent dual-write loss.
- Consumers must be idempotent by `eventId`.
- Deletions are logical domain changes; consumers should not assume hard database deletes.
