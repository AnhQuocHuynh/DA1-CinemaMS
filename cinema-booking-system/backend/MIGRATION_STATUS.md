# Backend Migration Status

Updated: 2026-08-03

## Safety Position

`backend_legacy` remains the runnable full backend. `backend` now contains independently buildable Catalog, Facility, Showtime, Booking, Analytics, and Recommendation slices, but the whole product is not cut over yet.

Spring Boot workstream scope: continue Catalog, Showtime, Booking, Analytics, and Recommendation. Do not expand ASP.NET-assigned services from `architecture_refactor.md`: Identity, target Facility, Payment, Notification, or API Gateway.

## Completed

- Added a Maven aggregator for `backend`.
- Extracted `catalog-service` from `backend_legacy` into `backend/services/catalog-service`.
- Extracted `facility-service` from `backend_legacy` into `backend/services/facility-service`.
- Extracted `showtime-service` from `backend_legacy` into `backend/services/showtime-service`.
- Extracted `booking-service` from `backend_legacy` into `backend/services/booking-service`.
- Added a buildable Spring Boot `analytics-service` dashboard API surface, optional PostgreSQL read-model query path, and idempotent event projection component for order/movie events.
- Added a buildable Spring Boot `recommendation-service` API surface with safe empty fallback responses.
- Added isolated Catalog, Facility, Showtime, Booking, Analytics, and Recommendation application bootstraps, configuration, tests, Dockerfiles, and Docker Compose support.
- Replaced the direct Catalog -> Showtime call during event creation with `EventShowtimeClient`; standalone Catalog now calls Showtime internal command endpoints and fails closed if sync fails.
- Extended cross-module read contracts in `backend_legacy` so Showtime can read Catalog and Facility through boundaries instead of direct repositories/entities.
- Replaced Facility's direct JPQL dependency on Showtime with `FacilityShowtimeGuard`; standalone Facility now queries Showtime internal guard endpoints and fails closed if Showtime is unavailable.
- Added Showtime HTTP read clients for Catalog and Facility internal projection APIs.
- Added Showtime internal seat-reservation endpoints for Booking extraction.
- Added internal Showtime future-showtime guard endpoints for Facility destructive deletes.
- Added internal Showtime event command endpoints for Catalog event showtime creation/deletion.
- Added draft data migration export/restore scripts and rollback runbook under `backend/infrastructure/migrations`.
- Hardened migration scripts with dry-run support, compose-port restore defaults, row-count comparison, and Analytics read-model backfill.
- Revalidated all migration dry-runs on 2026-08-03 and added fail-fast noninteractive authentication, explicit reset confirmation phrases, dump integrity checks, transactional service restores, and atomic Analytics imports.
- Added static contract tests that guard Spring Boot inter-service client paths against OpenAPI drafts.
- Added a baseline runtime smoke script for service health and internal-token guard checks.
- Added transactional outboxes to Catalog and Booking. Catalog records movie lifecycle events; Booking records paid/refunded order and created-review events with versioned envelopes.
- Added opt-in RabbitMQ outbox relays for Catalog and Booking with pessimistic row locking, exponential backoff, and terminal failed-event status after ten attempts.
- Defined shared event contracts, exchanges, routing keys, and idempotent-consumer requirements for future RabbitMQ delivery.
- Verified `backend_legacy` tests pass after boundary changes.
- Verified `backend` tests pass for the extracted services.

## Current Service Matrix

| Service | Status | Notes |
|---|---|---|
| catalog-service | Extracted, buildable | Own Spring Boot app, own DB config, OpenAPI draft present. Movie lifecycle events are stored and relayed through an opt-in transactional outbox. Event showtime sync still calls Showtime over internal HTTP. |
| facility-service | Extracted, buildable | Existing Spring Boot compatibility slice; target implementation is ASP.NET per architecture doc. Keep further changes minimal and contract-driven. |
| showtime-service | Extracted, buildable | Own Spring Boot app, own DB/Redis config, OpenAPI draft present. Reads Catalog/Facility through HTTP clients and exposes internal guard/seat-reservation endpoints. |
| booking-service | Extracted, buildable | Own Spring Boot app, own DB config, OpenAPI draft present. Calls Showtime internal seat-reservation endpoints and Catalog/Facility projections over HTTP; payment/review lifecycle events are stored and relayed through an opt-in transactional outbox. |
| analytics-service | Partial, buildable | Own Spring Boot app, OpenAPI draft, optional PostgreSQL read model, and backfill script. Its projection component is idempotent and ignores stale order/movie updates; the AMQP listener is not wired yet. |
| recommendation-service | Skeleton, buildable | Own Spring Boot app and OpenAPI draft. Neo4j, Redis, RabbitMQ consumers, and graph backfill are not wired yet. |
| identity-service | Placeholder | Still in legacy IAM. |
| api-gateway | Placeholder | Required before external cutover. |
| payment-service | Placeholder | Dedicated payment service is not extracted; payment handling currently lives inside booking-service and legacy backend. |

## Not Cut Over Yet

- Frontend still targets the legacy `/api/**` backend contract.
- Catalog data has not been backfilled from `cinema_db` to `cinema_catalog_db`.
- Facility data has not been backfilled from `cinema_db` to `cinema_facility_db`.
- Showtime data and active Redis holds have not been backfilled/migrated from legacy runtime.
- Booking/order/ticket/voucher/review data has not been backfilled from `cinema_db` to `cinema_booking_db`.
- Analytics read-model data has not been backfilled from a copied legacy database to `cinema_analytics_db`.
- Recommendation graph data has not been backfilled; Neo4j/Redis/RabbitMQ integration is not wired.
- Migration scripts have not been executed against a real database snapshot yet. Local PostgreSQL 18 can start on port 5432, but the configured `postgres` credential is unavailable and the documented default password is not valid for that cluster.
- Admin/staff write endpoints in direct Catalog, Facility, Showtime, and Booking services still depend on future gateway/JWT integration.
- Catalog event creation still synchronously calls Showtime internal commands. The movie outbox relay is implemented, but replacing that command with an asynchronous saga remains future work.
- Standalone Facility rejects destructive room/cinema deletes with `SHOWTIME_GUARD_UNAVAILABLE` if it cannot query `showtime-service`.
- Standalone Showtime requires Catalog and Facility to be reachable for create/enrichment paths.
- No production-grade service discovery, gateway routing, tracing, RabbitMQ publisher confirms, or AMQP listener adapters are wired yet.

## Next Safe Steps

1. Execute migration dry-run, restore into copied service databases, and verify row counts.
2. Run `infrastructure/smoke-test.ps1` against the extracted-service stack before any frontend route switch.
3. Continue Spring Boot-only roadmap with Analytics event ingestion or Recommendation graph integration after migration dry-run gates.

## Cutover Gates

- Legacy tests pass.
- Extracted service tests pass.
- Contract tests pass for every service call replacing a direct repository/service dependency.
- Runtime smoke script passes against the extracted-service stack.
- Database migration is repeatable and idempotent.
- Frontend smoke tests pass against the gateway route.
- Rollback can return traffic to `backend_legacy` without data loss.
