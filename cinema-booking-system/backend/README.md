# Cinema Backend Services

This folder is the microservice migration target. The full runnable application is still `../backend_legacy` until each service has passed its cutover gates.

## Current Status

- `services/catalog-service` owns catalog data: movies, genres, events, and catalog search.
- `services/facility-service` is the current Spring Boot compatibility slice for facility data. The target Facility service is ASP.NET per `../docs/architecture_refactor.md`, so keep further Spring changes minimal and contract-driven.
- `services/showtime-service` owns showtimes, showtime seats, seat holds, and seat reservation state transitions.
- `services/booking-service` owns orders, payments, tickets, vouchers, and reviews.
- `services/analytics-service` maintains a PostgreSQL dashboard read model through durable, idempotent RabbitMQ projections.
- `services/recommendation-service` serves Neo4j-backed popular, similar, personalized, and hybrid recommendations, with durable event projections and a safe disabled-graph fallback.
- Other service folders are still placeholders unless noted in `MIGRATION_STATUS.md`.
- The legacy monolith remains the source of truth for the complete booking flow while migration continues.

## Verify

From `cinema-booking-system/backend`:

```powershell
& ..\..\.codex-tools\apache-maven-3.9.9\bin\mvn.cmd clean verify
```

If Maven is available globally, `mvn clean verify` is enough.

Runtime smoke test after services are running:

```powershell
.\infrastructure\smoke-test.ps1
```

To build/start the Docker stack and then smoke test it:

```powershell
.\infrastructure\smoke-test.ps1 -StartCompose
```

Add `-StopCompose` when the script should tear the stack down after the checks.

To verify RabbitMQ delivery, duplicate handling, stale-event ordering, Analytics
projection, and Recommendation projection in one disposable evidence flow:

```powershell
.\infrastructure\event-flow-smoke.ps1 -StartCompose -StopCompose
```

## Run Services With Docker

From `cinema-booking-system/backend`:

```powershell
docker compose -f infrastructure\docker-compose.yml up --build
```

Catalog API:

- Service: `http://localhost:8081`
- Health: `http://localhost:8081/actuator/health`
- Database: `localhost:5432/cinema_catalog_db`

Facility API:

- Service: `http://localhost:5002`
- Health: `http://localhost:5002/actuator/health`
- Database: `localhost:5432/cinema_facility_db`

Showtime API:

- Service: `http://localhost:8082`
- Health: `http://localhost:8082/actuator/health`
- Database: `localhost:5432/cinema_showtime_db`
- Redis: `localhost:6380`

Booking API:

- Service: `http://localhost:8083`
- Health: `http://localhost:8083/actuator/health`
- Database: `localhost:5432/cinema_booking_db`

Analytics API:

- Service: `http://localhost:8084`
- Health: `http://localhost:8084/actuator/health`
- Database: `localhost:5432/cinema_analytics_db`

Recommendation API:

- Service: `http://localhost:8085`
- Health: `http://localhost:8085/actuator/health`

The microservices share a single PostgreSQL 18 container on host port `5432` with logical database isolation (`cinema_catalog_db`, `cinema_facility_db`, `cinema_showtime_db`, `cinema_booking_db`, `cinema_analytics_db`, etc.) initialized via `init-multiple-databases.sql`. Showtime Redis uses host port `6380` so it can run beside legacy Redis on `6379`.

Internal service-to-service endpoints under `/internal/**` require `X-Internal-Token`. For local Docker, set `INTERNAL_API_TOKEN` or use the documented dev default `local-dev-internal-token`.

## Keycloak Integration

Catalog, Showtime, Booking, Analytics, and Recommendation can validate Keycloak
JWTs directly as OAuth2 Resource Servers. Facility is intentionally excluded
because the target Facility service belongs to the ASP.NET workstream.

JWT enforcement is opt-in until the shared Keycloak realm and Gateway are
merged. Configure all Spring services with:

- `CINEMA_SECURITY_JWT_ENABLED=true`
- `KEYCLOAK_ISSUER_URI`: exact canonical realm issuer from the token `iss`
- `KEYCLOAK_AUDIENCE`: required backend audience, default `cinema-api`
- `KEYCLOAK_JWK_SET_URI`: optional internal JWKS backchannel URL when containers
  cannot reach discovery through the canonical issuer hostname

When JWT enforcement is enabled, the services validate signature, issuer,
audience, expiry, and not-before time. Keycloak realm roles map only `ADMIN`,
`STAFF`, and `CUSTOMER` to Spring `ROLE_*` authorities; system roles and legacy
`USER` are ignored. Booking, Showtime seat holds, and personalized
Recommendation use the signed numeric `user_id` claim and reject conflicting
body, query, path, or transitional header values.

Keep `CINEMA_SECURITY_JWT_ENABLED=false` for the current standalone smoke stack.
Do not enable it until Keycloak publishes the agreed audience and `user_id`
claim and Gateway forwards the original bearer token. See
`../docs/authentication_integration_contract.md` for the cross-framework
contract and remaining Gateway/.NET work.

RabbitMQ is declared at `localhost:5672` (management UI `http://localhost:15672`). Docker enables the Catalog and Booking outbox relays with the `cinema` user; set `RABBITMQ_PASSWORD` outside local development. Local service runs leave `OUTBOX_DISPATCHER_ENABLED=false` unless a reachable broker and the matching exchanges are configured.

Catalog uses `SHOWTIME_SERVICE_URL` to create and delete event showtimes through Showtime internal command endpoints.
Facility uses `SHOWTIME_SERVICE_URL` to call Showtime internal guard endpoints before destructive cinema/room deactivation.
Booking uses `CATALOG_SERVICE_URL`, `FACILITY_SERVICE_URL`, and `SHOWTIME_SERVICE_URL` for read enrichment and seat-reservation state transitions.

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
- `SHOWTIME_SERVICE_URL` for Catalog event showtime sync and Facility destructive-delete validation

For Facility, use the same pattern from `services\facility-service`; the default service port is `5002` and the default database is `cinema_facility_db`.

## Contracts

- OpenAPI drafts: `shared/contracts/catalog-service.openapi.yml`, `shared/contracts/facility-service.openapi.yml`, `shared/contracts/showtime-service.openapi.yml`, `shared/contracts/booking-service.openapi.yml`
- Event contracts: `shared/events/README.md`

Contracts are versioned before wiring consumers so downstream services can be migrated without direct repository access.

Catalog and Booking write domain events into local `outbox_events` tables in the same transaction as the domain change. Their opt-in relay publishes pending rows to durable topic exchanges and retries failures with exponential backoff; rows that fail ten times become `FAILED` for manual inspection. The relay is at-least-once, so consumers must deduplicate on the envelope `eventId`.

## Data Migration

Guarded export/restore scripts and rollback notes live in `infrastructure/migrations/`. Run them only against a copied legacy database first; the scripts are not a cutover by themselves.
Use `-DryRun` on export/restore scripts before touching real databases, and run `infrastructure\migrations\verify-service-counts.ps1` before any route switch. Verification compares row counts, order-independent content fingerprints, and owned ID-sequence state so the first post-cutover write cannot reuse an existing ID.

The complete migration procedure can be rehearsed against an isolated PostgreSQL
fixture on host port `55432` without touching existing databases:

```powershell
.\infrastructure\migrations\migration-rehearsal.ps1
```
