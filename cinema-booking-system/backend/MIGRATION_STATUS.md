# Backend Migration Status

Updated: 2026-07-08

## Safety Position

`backend_legacy` remains the runnable full backend. `backend` now contains independently buildable Catalog, Facility, Showtime, and Booking slices, but the whole product is not cut over yet.

Spring Boot workstream scope: continue Catalog, Showtime, Booking, Analytics, and Recommendation. Do not expand ASP.NET-assigned services from `architecture_refactor.md`: Identity, target Facility, Payment, Notification, or API Gateway.

## Completed

- Added a Maven aggregator for `backend`.
- Extracted `catalog-service` from `backend_legacy` into `backend/services/catalog-service`.
- Extracted `facility-service` from `backend_legacy` into `backend/services/facility-service`.
- Extracted `showtime-service` from `backend_legacy` into `backend/services/showtime-service`.
- Extracted `booking-service` from `backend_legacy` into `backend/services/booking-service`.
- Added isolated Catalog, Facility, Showtime, and Booking application bootstraps, configuration, tests, Dockerfiles, and Docker Compose support.
- Replaced the direct Catalog -> Showtime call during event creation with `EventShowtimeClient`; standalone Catalog now calls Showtime internal command endpoints and fails closed if sync fails.
- Extended cross-module read contracts in `backend_legacy` so Showtime can read Catalog and Facility through boundaries instead of direct repositories/entities.
- Replaced Facility's direct JPQL dependency on Showtime with `FacilityShowtimeGuard`; standalone Facility now queries Showtime internal guard endpoints and fails closed if Showtime is unavailable.
- Added Showtime HTTP read clients for Catalog and Facility internal projection APIs.
- Added Showtime internal seat-reservation endpoints for Booking extraction.
- Added internal Showtime future-showtime guard endpoints for Facility destructive deletes.
- Added internal Showtime event command endpoints for Catalog event showtime creation/deletion.
- Added draft data migration export/restore scripts and rollback runbook under `backend/infrastructure/migrations`.
- Added static contract tests that guard Spring Boot inter-service client paths against OpenAPI drafts.
- Verified `backend_legacy` tests pass after boundary changes.
- Verified `backend` tests pass for the extracted services.

## Current Service Matrix

| Service | Status | Notes |
|---|---|---|
| catalog-service | Extracted, buildable | Own Spring Boot app, own DB config, OpenAPI draft present. Event showtime sync calls Showtime over internal HTTP. |
| facility-service | Extracted, buildable | Existing Spring Boot compatibility slice; target implementation is ASP.NET per architecture doc. Keep further changes minimal and contract-driven. |
| showtime-service | Extracted, buildable | Own Spring Boot app, own DB/Redis config, OpenAPI draft present. Reads Catalog/Facility through HTTP clients and exposes internal guard/seat-reservation endpoints. |
| booking-service | Extracted, buildable | Own Spring Boot app, own DB config, OpenAPI draft present. Calls Showtime internal seat-reservation endpoints and Catalog/Facility projections over HTTP. |
| identity-service | Placeholder | Still in legacy IAM. |
| api-gateway | Placeholder | Required before external cutover. |
| payment-service | Placeholder | Dedicated payment service is not extracted; payment handling currently lives inside booking-service and legacy backend. |
| analytics-service | Placeholder | Admin aggregation still reads monolith data. |

## Not Cut Over Yet

- Frontend still targets the legacy `/api/**` backend contract.
- Catalog data has not been backfilled from `cinema_db` to `cinema_catalog_db`.
- Facility data has not been backfilled from `cinema_db` to `cinema_facility_db`.
- Showtime data and active Redis holds have not been backfilled/migrated from legacy runtime.
- Booking/order/ticket/voucher/review data has not been backfilled from `cinema_db` to `cinema_booking_db`.
- Migration scripts have not been executed against a real database snapshot yet.
- Admin/staff write endpoints in direct Catalog, Facility, Showtime, and Booking services still depend on future gateway/JWT integration.
- Catalog event creation now synchronously calls Showtime internal commands; durable outbox delivery is still not implemented.
- Standalone Facility rejects destructive room/cinema deletes with `SHOWTIME_GUARD_UNAVAILABLE` if it cannot query `showtime-service`.
- Standalone Showtime requires Catalog and Facility to be reachable for create/enrichment paths.
- No production-grade service discovery, gateway routing, tracing, or async outbox is wired yet.

## Next Safe Steps

1. Dry-run migration scripts against a copied legacy database and verify row counts.
2. Add runtime service smoke tests before any frontend route switch.
3. Continue Spring Boot-only roadmap with Analytics or Recommendation after migration dry-run gates.

## Cutover Gates

- Legacy tests pass.
- Extracted service tests pass.
- Contract tests pass for every service call replacing a direct repository/service dependency.
- Database migration is repeatable and idempotent.
- Frontend smoke tests pass against the gateway route.
- Rollback can return traffic to `backend_legacy` without data loss.
