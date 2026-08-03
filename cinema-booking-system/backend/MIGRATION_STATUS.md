# Backend Migration Status

Updated: 2026-08-03

## Safety Position

`backend_legacy` remains the runnable full backend. `backend` now contains independently buildable and runtime-smoke-tested Catalog, Facility, Showtime, Booking, Analytics, and Recommendation slices, but the whole product is not cut over yet.

Spring Boot workstream scope: continue Catalog, Showtime, Booking, Analytics, and Recommendation. Do not expand ASP.NET-assigned services from `architecture_refactor.md`: Identity, target Facility, Payment, Notification, or API Gateway.

## Completed

- Added a Maven aggregator for `backend`.
- Extracted `catalog-service` from `backend_legacy` into `backend/services/catalog-service`.
- Extracted `facility-service` from `backend_legacy` into `backend/services/facility-service`.
- Extracted `showtime-service` from `backend_legacy` into `backend/services/showtime-service`.
- Extracted `booking-service` from `backend_legacy` into `backend/services/booking-service`.
- Added a buildable Spring Boot `analytics-service` dashboard API surface, optional PostgreSQL read-model query path, and idempotent event projection component for order/movie events.
- Added durable Analytics RabbitMQ consumers and dead-letter queues for Catalog and Booking events, with validation, retry, idempotency, ordering guards, and metrics.
- Added a buildable Spring Boot `recommendation-service` backed by Neo4j for popular, similar, personalized, and hybrid recommendations, with safe fallback responses.
- Added durable Recommendation RabbitMQ consumers and dead-letter queues that project Catalog and Booking events atomically and reject stale order state transitions.
- Added an idempotent Recommendation graph backfill from a read-only copied legacy database. Execution is dry-run by default and requires an exact confirmation phrase for writes.
- Added isolated Catalog, Facility, Showtime, Booking, Analytics, and Recommendation application bootstraps, configuration, tests, Dockerfiles, and Docker Compose support.
- Replaced the direct Catalog -> Showtime call during event creation with `EventShowtimeClient`; standalone Catalog now calls Showtime internal command endpoints and fails closed if sync fails.
- Extended cross-module read contracts in `backend_legacy` so Showtime can read Catalog and Facility through boundaries instead of direct repositories/entities.
- Replaced Facility's direct JPQL dependency on Showtime with `FacilityShowtimeGuard`; standalone Facility now queries Showtime internal guard endpoints and fails closed if Showtime is unavailable.
- Added Showtime HTTP read clients for Catalog and Facility internal projection APIs.
- Added Showtime internal seat-reservation endpoints for Booking extraction.
- Added internal Showtime future-showtime guard endpoints for Facility destructive deletes.
- Added internal Showtime event command endpoints for Catalog event showtime creation/deletion.
- Added guarded data migration export/restore scripts and rollback runbook under `backend/infrastructure/migrations`.
- Hardened migration with source relational-invariant checks, an atomic SHA-256 manifest, client/server compatibility checks, transactional restores, and row-count plus content-fingerprint reconciliation.
- Added a disposable PostgreSQL rehearsal that proves two repeatable restore/verification passes, two repeatable Analytics backfills, and rejection of a tampered dump before target mutation.
- Added static contract tests that guard Spring Boot inter-service client paths against OpenAPI drafts.
- Added a runtime smoke script for service health, API envelopes, internal-token guards, and all Analytics/Recommendation consumer and dead-letter queues.
- Added an end-to-end event-flow test for RabbitMQ routing, duplicate delivery, stale-order-event rejection, Analytics persistence, Neo4j persistence, Recommendation API behavior, and evidence cleanup.
- Added transactional outboxes to Catalog and Booking. Catalog records movie lifecycle events; Booking records paid/refunded order and created-review events with versioned envelopes.
- Added opt-in RabbitMQ outbox relays for Catalog and Booking with pessimistic row locking, exponential backoff, publisher confirms/mandatory-return checks, metrics, and terminal failed-event status after ten attempts.
- Defined shared event contracts, exchanges, routing keys, and idempotent-consumer requirements for future RabbitMQ delivery.
- Verified `backend_legacy` tests pass after boundary changes.
- Verified all six Spring service Docker images build as executable non-root Java 21 images.
- Verified the full extracted stack boots with PostgreSQL, Redis, RabbitMQ, and Neo4j; all runtime smoke assertions pass and the stack is stopped afterward without deleting data volumes.
- Verified `backend` tests pass: 149 tests, 0 failures, 0 errors, and 0 skipped.
- Upgraded backend CI to run `mvn clean verify`, validate Compose and migration scripts, and execute the full event-flow integration test with failure diagnostics and guaranteed teardown.

## Spring Workstream Readiness

The repository-controlled preparation work for the Spring-owned migration scope is **complete (100%)**. This is a scoped implementation and migration-readiness statement, not a claim of 100% Java line coverage or a claim that production traffic has been cut over.

- Catalog, Showtime, and Booking are independently buildable, have isolated persistence configuration, and use explicit HTTP/event boundaries instead of cross-service repositories.
- Analytics and Recommendation now have functional event ingestion, idempotent projections, dead-letter handling, metrics, and persistent read models.
- Catalog and Booking event delivery uses transactional outboxes and waits for broker publisher confirms before marking an event published.
- Unit, contract, Spring-context, Neo4j integration, package, Docker build, and full-stack smoke checks are green.
- Event-flow idempotency/ordering and disposable data-migration repeatability/integrity checks are green and enforced by CI where practical.
- No further Spring service extraction is required before snapshot rehearsal. Remaining actions require an actual copied database and coordinated external traffic ownership.

## Current Service Matrix

| Service | Status | Notes |
|---|---|---|
| catalog-service | Migration-prepared, awaiting real snapshot | Own Spring Boot app, DB, OpenAPI draft, confirmed transactional outbox, internal projections, and runtime smoke coverage. Event showtime sync still calls Showtime over internal HTTP. |
| facility-service | Extracted, buildable | Existing Spring Boot compatibility slice; target implementation is ASP.NET per architecture doc. Keep further changes minimal and contract-driven. |
| showtime-service | Migration-prepared, awaiting real snapshot | Own Spring Boot app, DB/Redis configuration, OpenAPI draft, HTTP clients, and internal guard/seat-reservation endpoints. |
| booking-service | Migration-prepared, awaiting real snapshot | Own Spring Boot app, DB, OpenAPI draft, confirmed transactional outbox, and HTTP boundaries for Showtime/Catalog/Facility. |
| analytics-service | Migration-prepared, awaiting real snapshot | Own Spring Boot app, PostgreSQL read model, OpenAPI draft, idempotent AMQP projections, retries, DLQs, ordering guards, metrics, and repeatable backfill support. |
| recommendation-service | Migration-prepared, awaiting real snapshot | Own Spring Boot app, Neo4j graph queries, AMQP projections, retries, DLQs, metrics, safe fallback, schema checks, and guarded idempotent legacy backfill. |

## Not Cut Over Yet

- Frontend still targets the legacy `/api/**` backend contract.
- Catalog data has not been backfilled from `cinema_db` to `cinema_catalog_db`.
- Facility data has not been backfilled from `cinema_db` to `cinema_facility_db`.
- Showtime data and active Redis holds have not been backfilled/migrated from legacy runtime.
- Booking/order/ticket/voucher/review data has not been backfilled from `cinema_db` to `cinema_booking_db`.
- Analytics read-model data has not been backfilled from a copied legacy database to `cinema_analytics_db`.
- Recommendation graph data has not been backfilled from a real copied legacy database; the Neo4j/RabbitMQ implementation itself is wired and smoke-tested.
- Migration scripts have not been executed against a real database snapshot yet. The disposable rehearsal is green, but no valid copied-snapshot credential is available in the repository environment.
- Admin/staff write endpoints in direct Catalog, Facility, Showtime, and Booking services still depend on future gateway/JWT integration.
- Catalog event creation still synchronously calls Showtime internal commands. The movie outbox relay is implemented, but replacing that command with an asynchronous saga remains future work.
- Standalone Facility rejects destructive room/cinema deletes with `SHOWTIME_GUARD_UNAVAILABLE` if it cannot query `showtime-service`.
- Standalone Showtime requires Catalog and Facility to be reachable for create/enrichment paths.
- No production gateway routing or distributed tracing is wired yet. Service discovery remains static Compose DNS/configuration, which is sufficient for the current deployment target but must be revisited for multi-host orchestration.

## Next Safe Steps

1. Obtain credentials for a copied legacy PostgreSQL snapshot and run the documented dry-run, restore, fingerprint, Analytics, and Recommendation sequence against disposable targets.
2. Archive the manifest and reconciliation reports as cutover evidence; investigate any mismatch instead of bypassing a guard.
3. Coordinate shadow traffic, cutover, and rollback with the external traffic owner while `backend_legacy` remains available; do not switch writes until rollback and data ownership are approved.

## Cutover Gates

- Legacy tests pass.
- Extracted service tests pass.
- Contract tests pass for every service call replacing a direct repository/service dependency.
- Runtime smoke script passes against the extracted-service stack. **Passed locally on 2026-08-03.**
- RabbitMQ-to-Analytics/Neo4j event flow is duplicate-safe and ordering-safe. **Passed locally on 2026-08-03 and automated in CI.**
- Database migration is repeatable and content-verified on the disposable fixture. **Passed two consecutive cycles locally on 2026-08-03.**
- The same migration evidence passes against a real copied snapshot. **Pending snapshot credential/execution.**
- Frontend smoke tests pass against the gateway route.
- Rollback can return traffic to `backend_legacy` without data loss.
