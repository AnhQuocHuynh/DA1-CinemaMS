# Backend Migration Status

Updated: 2026-07-08

## Safety Position

`backend_legacy` remains the runnable full backend. `backend` now contains independently buildable Catalog, Facility, and Showtime slices, but the whole product is not cut over yet.

## Completed

- Added a Maven aggregator for `backend`.
- Extracted `catalog-service` from `backend_legacy` into `backend/services/catalog-service`.
- Extracted `facility-service` from `backend_legacy` into `backend/services/facility-service`.
- Extracted `showtime-service` from `backend_legacy` into `backend/services/showtime-service`.
- Added isolated Catalog, Facility, and Showtime application bootstraps, configuration, tests, Dockerfiles, and Docker Compose support.
- Replaced the direct Catalog -> Showtime call during event creation with `EventShowtimeClient`; standalone Catalog now calls Showtime internal command endpoints and fails closed if sync fails.
- Extended cross-module read contracts in `backend_legacy` so Showtime can read Catalog and Facility through boundaries instead of direct repositories/entities.
- Replaced Facility's direct JPQL dependency on Showtime with `FacilityShowtimeGuard`; standalone Facility now queries Showtime internal guard endpoints and fails closed if Showtime is unavailable.
- Added Showtime HTTP read clients for Catalog and Facility internal projection APIs.
- Added Showtime internal seat-reservation endpoints for future Booking extraction.
- Added internal Showtime future-showtime guard endpoints for Facility destructive deletes.
- Added internal Showtime event command endpoints for Catalog event showtime creation/deletion.
- Verified `backend_legacy` tests pass after boundary changes.
- Verified `backend` tests pass for the extracted services.

## Current Service Matrix

| Service | Status | Notes |
|---|---|---|
| catalog-service | Extracted, buildable | Own Spring Boot app, own DB config, OpenAPI draft present. Event showtime sync calls Showtime over internal HTTP. |
| facility-service | Extracted, buildable | Own Spring Boot app, own DB config, OpenAPI draft present. Delete guards call Showtime through internal HTTP and fail closed if unavailable. |
| showtime-service | Extracted, buildable | Own Spring Boot app, own DB/Redis config, OpenAPI draft present. Reads Catalog/Facility through HTTP clients and exposes internal guard/seat-reservation endpoints. |
| booking-service | Prepared partially | Booking now talks to Showtime via `SeatReservationService` boundary; remote client/outbox work remains. |
| identity-service | Placeholder | Still in legacy IAM. |
| api-gateway | Placeholder | Required before external cutover. |
| payment-service | Placeholder | Payment flow still in legacy booking module. |
| analytics-service | Placeholder | Admin aggregation still reads monolith data. |

## Not Cut Over Yet

- Frontend still targets the legacy `/api/**` backend contract.
- Catalog data has not been backfilled from `cinema_db` to `cinema_catalog_db`.
- Facility data has not been backfilled from `cinema_db` to `cinema_facility_db`.
- Showtime data and active Redis holds have not been backfilled/migrated from legacy runtime.
- Admin write endpoints in direct Catalog/Facility services still depend on future gateway/JWT integration.
- Catalog event creation now synchronously calls Showtime internal commands; durable outbox delivery is still not implemented.
- Standalone Facility rejects destructive room/cinema deletes with `SHOWTIME_GUARD_UNAVAILABLE` if it cannot query `showtime-service`.
- Standalone Showtime requires Catalog and Facility to be reachable for create/enrichment paths.
- No production-grade service discovery, gateway routing, tracing, or async outbox is wired yet.

## Next Safe Steps

1. Extract `booking-service` with an HTTP client for Showtime internal seat-reservation endpoints.
2. Add contract tests between Catalog, Facility, Showtime, and Booking before any frontend route switch.
3. Add data migration scripts and rollback paths for `cinema_catalog_db`, `cinema_facility_db`, and `cinema_showtime_db`.
4. Introduce API gateway routing only after service-level smoke tests pass.

## Cutover Gates

- Legacy tests pass.
- Extracted service tests pass.
- Contract tests pass for every service call replacing a direct repository/service dependency.
- Database migration is repeatable and idempotent.
- Frontend smoke tests pass against the gateway route.
- Rollback can return traffic to `backend_legacy` without data loss.
