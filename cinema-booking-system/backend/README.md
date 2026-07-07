# Cinema Backend Services

This folder is the microservice migration target. The full runnable application is still `../backend_legacy` until each service has passed its cutover gates.

## Current Status

- `services/catalog-service` owns catalog data: movies, genres, events, and catalog search.
- `services/facility-service` owns facility data: cinemas, rooms, seat templates, and seat types.
- `services/showtime-service` owns showtimes, showtime seats, seat holds, and seat reservation state transitions.
- Other service folders are still placeholders unless noted in `MIGRATION_STATUS.md`.
- The legacy monolith remains the source of truth for the complete booking flow while migration continues.

## Verify

From `cinema-booking-system/backend`:

```powershell
& ..\..\.codex-tools\apache-maven-3.9.9\bin\mvn.cmd test
```

If Maven is available globally, `mvn test` is enough.

## Run Catalog Service With Docker

From `cinema-booking-system/backend`:

```powershell
docker compose -f infrastructure\docker-compose.yml up --build
```

Catalog API:

- Service: `http://localhost:8081`
- Health: `http://localhost:8081/actuator/health`
- Database: `localhost:5433/cinema_catalog_db`

Facility API:

- Service: `http://localhost:5002`
- Health: `http://localhost:5002/actuator/health`
- Database: `localhost:5434/cinema_facility_db`

Showtime API:

- Service: `http://localhost:8082`
- Health: `http://localhost:8082/actuator/health`
- Database: `localhost:5435/cinema_showtime_db`
- Redis: `localhost:6380`

The host database ports are intentionally `5433`, `5434`, and `5435` so services can run beside the legacy monolith database on `5432`. Showtime Redis uses host port `6380` so it can run beside legacy Redis on `6379`.

Internal service-to-service endpoints under `/internal/**` require `X-Internal-Token`. For local Docker, set `INTERNAL_API_TOKEN` or use the documented dev default `local-dev-internal-token`.

Facility uses `SHOWTIME_SERVICE_URL` to call Showtime internal guard endpoints before destructive cinema/room deactivation.

## Run Catalog Service Locally

Start PostgreSQL with database `cinema_catalog_db`, then run:

```powershell
cd services\catalog-service
& ..\..\..\.codex-tools\apache-maven-3.9.9\bin\mvn.cmd spring-boot:run
```

Override connection settings with:

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `SERVER_PORT`
- `INTERNAL_API_TOKEN`
- `SHOWTIME_SERVICE_URL` for Facility when it must validate destructive deletes against Showtime

For Facility, use the same pattern from `services\facility-service`; the default service port is `5002` and the default database is `cinema_facility_db`.

## Contracts

- OpenAPI drafts: `shared/contracts/catalog-service.openapi.yml`, `shared/contracts/facility-service.openapi.yml`, `shared/contracts/showtime-service.openapi.yml`
- Event contract draft: `shared/events/catalog-events.md`

Contracts are versioned before wiring consumers so downstream services can be migrated without direct repository access.
