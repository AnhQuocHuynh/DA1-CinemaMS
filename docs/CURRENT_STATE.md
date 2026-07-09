# Current State

## Snapshot

- Date of handoff: 2026-07-10.
- Branch: `refactor-n-decoupling`.
- Runnable full backend remains `cinema-booking-system/backend_legacy/`.
- `cinema-booking-system/backend/` now contains extracted `catalog-service`, `facility-service`, `showtime-service`, `booking-service`, `analytics-service`, and `recommendation-service` Spring Boot services.

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
- `backend/infrastructure/docker-compose.yml` runs Catalog, Facility, Showtime, Booking, Analytics, and Recommendation with separate PostgreSQL databases plus Showtime Redis.
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
- Standalone Analytics exposes admin dashboard route compatibility and can query an optional PostgreSQL read model; event ingestion is not wired yet.
- Standalone Recommendation exposes recommendation route compatibility with safe empty fallback responses until Neo4j/RabbitMQ integration is wired.
- Static contract tests now guard Spring Boot client paths against the OpenAPI drafts for Catalog, Facility, Showtime, and Booking.
- Do not expand ASP.NET-assigned services in this Spring Boot track: Identity, target Facility, Payment, Notification, and API Gateway.

## Commands To Verify

From workspace root `D:\UNI_DOCS\HK6\DA1\DA1-CinemaMS`:

```powershell
git status --short
```

Legacy backend tests:

```powershell
cd cinema-booking-system\backend_legacy
..\..\.codex-tools\apache-maven-3.9.9\bin\mvn.cmd test
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
- Legacy Redis: `localhost:6379`.

## Seed/Test Accounts

From `backend_legacy/src/main/resources/FE_SEED_DATA_REFERENCE.md`:

- Admin: `admin@cinema.com` / `admin123`.
- Staff: `staff@cinema.com` / `staff123`.
- Customer: `customer@cinema.com` / `customer123`.
- Locked customer: `locked@cinema.com` / `locked123`.

## Known Verification Gaps

- Frontend build was not rerun during the latest backend-service extraction.
- Docker images were not built; compose syntax was validated.
- Data backfill scripts/runbook exist, but they have not been executed against a real database snapshot.
- Migration scripts now support dry-run validation, row-count comparison across legacy/service databases, and Analytics read-model backfill.
- Local preflight on 2026-07-08 found PostgreSQL 18 client tools under `C:\Program Files\PostgreSQL\18\bin`, but Docker and local DB/service ports were not running.
- Runtime service smoke script exists, but it has not been executed against a running extracted-service stack in this handoff.
- API gateway routing and JWT propagation are not wired yet.

## Suggested Next Steps

1. Execute data backfill scripts against a copied legacy database and verify row counts.
2. Run extracted-service runtime smoke tests before switching frontend traffic away from `backend_legacy`.
3. Continue Spring Boot-only roadmap with Analytics or Recommendation after migration dry-run gates.
