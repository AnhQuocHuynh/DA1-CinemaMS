# Current State

## Snapshot

- Date of handoff: 2026-08-06.
- Branch: `refactor-n-decoupling`.
- Runnable full backend remains `cinema-booking-system/backend_legacy/`.
- `cinema-booking-system/backend/` now contains extracted, independently buildable, and full-stack-smoke-tested `catalog-service`, `facility-service`, `showtime-service`, `booking-service`, `analytics-service`, and `recommendation-service` Spring Boot services.

## Exact Repository State

- `backend_legacy` is still the source of truth for the complete booking flow.
- `backend` is a partial microservice migration target, not a full replacement yet.
- Extracted services:
  - `backend/services/catalog-service`
  - `backend/services/facility-service`
  - `backend/services/showtime-service`
  - `backend/services/booking-service`
  - `backend/services/analytics-service`
  - `backend/services/recommendation-service`
- Remaining service folders are placeholders unless documented otherwise.
- `backend/infrastructure/docker-compose.yml` runs Catalog, Facility, Showtime, Booking, Analytics, and Recommendation with separate PostgreSQL databases, Showtime Redis, RabbitMQ, and Neo4j.
- `backend_legacy/src/main/resources/application.yml` now has a valid Base64 JWT default while preserving `APP_JWT_SECRET`.
- `backend_legacy/src/main/resources/DB_PATCH_2026_06_25_SEAT_MAP.sql` is present in source.

## Migration Notes

- Booking/Payment/Staff have been reduced to use Showtime seat-reservation boundaries instead of direct showtime repositories.
- Showtime now reads Catalog and Facility through read-service boundaries instead of direct cross-module repositories/entities.
- Facility now checks future-showtime conflicts through `FacilityShowtimeGuard` instead of direct JPQL in service methods.
- Standalone Facility now queries Showtime internal guard endpoints for destructive room/cinema deletes and fails closed if Showtime is unavailable.
- Standalone Catalog now uses `EventShowtimeClient` over internal HTTP to create/delete event showtimes and fails closed if Showtime sync fails.
- Standalone Showtime reads Catalog/Facility through HTTP clients and exposes internal command, guard, and seat-reservation endpoints for future service extraction.
- Standalone Booking calls Showtime internal seat-reservation endpoints and uses Catalog/Facility internal projections for response enrichment.
- Standalone Analytics exposes admin dashboard route compatibility and maintains its PostgreSQL read model through durable, idempotent RabbitMQ consumers for Catalog and Booking events.
- Standalone Recommendation serves popular, similar, personalized, and hybrid recommendations from Neo4j, with safe fallback responses when graph mode is disabled.
- Catalog records movie-created, movie-updated, and movie-deleted envelopes in a transactional outbox.
- Booking records order-paid, order-refunded, and review-created envelopes in a transactional outbox; paid events are enriched with the owning Showtime content identifier.
- Shared event contracts define the envelope, RabbitMQ exchanges, routing keys, and idempotent consumer rule before any broker is enabled.
- Analytics has idempotent, ordering-aware AMQP projections for paid/refunded orders and movie lifecycle events, with bounded retry, DLQs, validation, and metrics.
- Recommendation consumes the same durable event streams into Neo4j using atomic processed-event markers and timestamp guards for out-of-order order events.
- Recommendation includes a read-only copied-legacy-DB backfill that defaults to dry-run and requires exact confirmation before graph writes.
- Catalog and Booking have opt-in RabbitMQ outbox relays with mandatory routing and publisher-confirm checks before events are marked published.
- The event-flow smoke publishes duplicate and out-of-order events through RabbitMQ and verifies durable Analytics/Neo4j state plus Recommendation API behavior.
- Migration export now checks legacy relational invariants and writes a SHA-256 manifest; restore validates compatibility/checksums before mutation, and reconciliation compares content fingerprints rather than counts alone.
- A disposable PostgreSQL rehearsal passed two restore/reconciliation cycles, two Analytics backfills, and a tampered-dump rejection check on 2026-08-03.
- Static contract tests now guard Spring Boot client paths against the OpenAPI drafts for Catalog, Facility, Showtime, and Booking.
- Spring context tests protect JPA repository scanning, constructor injection, Redis typing, and AMQP queue binding; a packaged-runtime regression test protects Spring MVC parameter metadata.
- The extracted backend now has 179 passing tests. The 2026-08-06 verification
  ran all six service modules, including JWT validators/route policies,
  authenticated `user_id` binding, booking ownership, and seat-hold ownership.
- All six Docker images build as executable non-root Java 21 images. The full Compose stack and expanded runtime smoke suite passed locally on 2026-08-03, then the stack was stopped while named data volumes were retained.
- Repository-controlled preparation for the Spring-owned migration scope is complete. Remaining risk is external execution against a real copied snapshot and coordinated cutover/rollback, not missing Spring service code.
- Backend CI now enforces `mvn clean verify`, Compose and PowerShell validation, migration dry-runs, and the RabbitMQ-to-Analytics/Neo4j event-flow test.
- Do not expand ASP.NET-assigned services in this Spring Boot track: Identity, target Facility, Payment, Notification, and API Gateway.

## Commands To Verify

From workspace root `D:\UNI_DOCS\HK6\DA1\DA1-CinemaMS`:

```powershell
git status --short
```

Legacy backend tests:

```powershell
cd cinema-booking-system\backend_legacy
..\..\.codex-tools\apache-maven-3.9.9\bin\mvn.cmd clean verify
```

Extracted service tests:

```powershell
cd cinema-booking-system\backend
..\..\.codex-tools\apache-maven-3.9.9\bin\mvn.cmd test
```

Extracted service package:

```powershell
cd cinema-booking-system\backend
..\..\.codex-tools\apache-maven-3.9.9\bin\mvn.cmd package -DskipTests
```

Docker compose syntax:

```powershell
cd cinema-booking-system\backend
docker compose -f infrastructure\docker-compose.yml config
```

Extracted service runtime smoke:

```powershell
cd cinema-booking-system\backend
.\infrastructure\smoke-test.ps1
```

Event-flow integration with automatic stack lifecycle:

```powershell
cd cinema-booking-system\backend
.\infrastructure\event-flow-smoke.ps1 -StartCompose -StopCompose
```

Disposable data-migration rehearsal:

```powershell
cd cinema-booking-system\backend
.\infrastructure\migrations\migration-rehearsal.ps1
```

Frontend build:

```powershell
cd cinema-booking-system\frontend
npm install
npm run build
```

## Runtime Ports

- Legacy backend DB: `localhost:5432/cinema_db`.
- Catalog service: `localhost:8081`, DB `localhost:5433/cinema_catalog_db`.
- Facility service: `localhost:5002`, DB `localhost:5434/cinema_facility_db`.
- Showtime service: `localhost:8082`, DB `localhost:5435/cinema_showtime_db`, Redis `localhost:6380`.
- Booking service: `localhost:8083`, DB `localhost:5436/cinema_booking_db`.
- Analytics service: `localhost:8084`, DB `localhost:5437/cinema_analytics_db`.
- Recommendation service: `localhost:8085`.
- RabbitMQ: `localhost:5672`, management UI `localhost:15672`.
- Neo4j: browser `localhost:7474`, Bolt `localhost:7687`.
- Legacy Redis: `localhost:6379`.

## Seed/Test Accounts

From `backend_legacy/src/main/resources/FE_SEED_DATA_REFERENCE.md`:

- Admin: `admin@cinema.com` / `admin123`.
- Staff: `staff@cinema.com` / `staff123`.
- Customer: `customer@cinema.com` / `customer123`.
- Locked customer: `locked@cinema.com` / `locked123`.

## Known Verification Gaps

- Frontend build was not rerun during the latest backend-service extraction.
- All extracted-service Docker images and the full Compose runtime were verified locally on 2026-08-03.
- Data backfill has not been executed against a real copied database snapshot because no valid snapshot credential is available.
- Migration dry-runs and the isolated PostgreSQL rehearsal passed on 2026-08-03. Destructive resets require explicit confirmation, dumps require matching SHA-256 manifest entries, restores are transactional, and reconciliation verifies row content.
- PostgreSQL client/source/target major versions must be aligned for the real migration; the restore guard rejects a newer client before touching an older target.
- Runtime smoke verifies six service health endpoints, Analytics/Recommendation response envelopes, eight RabbitMQ consumer/DLQ queues, and internal-token guards; it passed with automatic Compose teardown.
- Event-flow smoke verifies duplicate delivery, stale-event ordering, Analytics and Neo4j projections, Recommendation API output, and evidence cleanup; it passed with automatic Compose teardown.
- API gateway routing and end-user JWT propagation are not wired because those are owned by the separate ASP.NET workstream.
- Catalog, Showtime, Booking, Analytics, and Recommendation now have opt-in
  Keycloak Resource Server enforcement with issuer/audience/JWKS validation and
  canonical role mapping. Booking, Showtime holds, and personalized
  Recommendation bind numeric identity to the signed `user_id` claim and reject
  caller-supplied mismatches. Activation remains off until the teammate-owned
  Keycloak/Gateway stack supplies the agreed claims and forwards bearer tokens.
- Production distributed tracing and multi-host service discovery are not configured.

## Suggested Next Steps

1. Obtain valid credentials for a copied legacy database and execute the guarded migration/backfill runbook against disposable targets.
2. Retain the SHA-256 manifest and fingerprint reports as migration evidence; stop on any mismatch.
3. Coordinate shadow traffic, write cutover, and rollback with the external traffic owner while keeping `backend_legacy` available.
