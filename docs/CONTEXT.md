# Project Context

Agent entry point: read `../AGENTS.md` and `SESSION_BOOTSTRAP.md` first. This
file is stable product context and should be opened only when the current task
needs modular-monolith background, repository shape, or run-mode details.

## Goal
Cinema Booking System is a university project for movie/event ticket booking, admin management, and staff counter operations. The practical goal is a solid, demo-ready booking management app, not production-grade microservices.

## Current Repository Shape
- `cinema-booking-system/backend_legacy/`: Spring Boot modular monolith and rollback source. Traffic has not moved off it.
- `cinema-booking-system/frontend/`: React/Vite SPA. API base defaults to the YARP gateway at `http://localhost:5000/api`. Auth is Keycloak (`keycloak-js`).
- `cinema-booking-system/backend/`: microservice stack. Spring Boot: Catalog, Showtime, Booking, Analytics, Recommendation. ASP.NET: Identity, Facility, Payment, Notification, API Gateway. Compose also runs Keycloak, one PostgreSQL 18 container, Redis, RabbitMQ, Neo4j, and MongoDB.
- `services/rental-service` has build output only. Room rental is not on this branch.
- `cinema-booking-system/docs/architecture_refactor.md`: target design, not an implementation checklist.
- Root-level `docs/`: handoff docs. Feature progress is in `docs/CURRENT_STATE.md`.
- `docs/SESSION_BOOTSTRAP.md`: concise current entry point and task-to-files routing.

## Runnable Architecture
The branch contains both the rollback monolith and the microservice stack. The SPA talks to the gateway. The modules below describe `backend_legacy` only.

Backend modules in `backend_legacy/src/main/java/com/uit/cinema/`:
- `core`: config, security, exception handling, health, seed data.
- `iam`: auth, users, roles, refresh/reset tokens.
- `catalog`: movies, events, genres, search/browse.
- `facility`: cinemas, rooms, seat templates, seat types.
- `showtime`: showtimes, generated showtime seats, seat map, seat hold/release via Redis.
- `booking`: orders, payments, refunds, vouchers, tickets, reviews.
- `admin`: dashboard aggregation endpoints.
- `staff`: ticket validation/check-in and counter booking.

Frontend areas in `frontend/src/`:
- `pages/portal`: customer booking and tickets.
- `pages/admin`: admin dashboard and management screens.
- `pages/staff`: staff dashboard, QR check, ticket lookup, counter booking.
- `services`: Axios API wrappers.
- `store`: Zustand state.
- `components/admin`, `components/portal`, `components/staff`: feature UI components.

## Tech Stack
- Backend: Java 21, Spring Boot 3.3.4, Maven, Spring Security, JWT via jjwt 0.12.6, Spring Data JPA/Hibernate, MapStruct, Lombok.
- Database/cache/messaging: PostgreSQL 18 for extracted Compose (logical
  database-per-service on one container); Redis 7, RabbitMQ 3.13, Neo4j 5.23.
  Legacy local Docker may still use PostgreSQL 16.
- Frontend: React 18, Vite 5, TypeScript, Tailwind CSS, Zustand, Axios, keycloak-js, i18next, Lucide React.
- Containers: `backend/infrastructure/docker-compose.yml` runs the microservice stack. `docker-compose-app.yml` may still point at the old backend path; inspect it before use.

## Major Decisions
- The demo path is the microservice Compose stack plus the React SPA. `backend_legacy` stays available as rollback until cutover gates pass.
- ASP.NET Identity, Facility, Payment, Notification, and the YARP gateway are implemented on this branch. They are no longer placeholder folders.
- A real copied snapshot and external traffic have not been cut over. August 2026 smoke results were not re-run for the 2026-10-11 status update.
- Event-only showtimes are allowed; `showtimes.movie_id` may be nullable via manual DB patch.
- Staff counter booking adds customer name/phone, `sales_channel`, and `created_by_staff_id` on orders.
- Seat map contract includes row/column labels, labels like `A1`, seat type, column span/couple seats, and pathway cells.
- Couple seats are modeled as seat templates with seat type metadata and wider `column_span`, not as two separate bookings unless service logic explicitly chooses otherwise.
- Redis is used for seat holds/TTL; PostgreSQL remains source of truth for orders/tickets/seats.

## Important Files
- Backend app: `cinema-booking-system/backend_legacy/src/main/java/com/uit/cinema/CinemaApplication.java`.
- Backend config: `cinema-booking-system/backend_legacy/src/main/resources/application.yml`.
- Backend Maven: `cinema-booking-system/backend_legacy/pom.xml`.
- Seed/reference for FE: `cinema-booking-system/backend_legacy/src/main/resources/FE_SEED_DATA_REFERENCE.md`.
- Staff booking DB patch: `cinema-booking-system/backend_legacy/src/main/resources/DB_PATCH_2026_06_24_STAFF_BOOKING.sql`.
- FE API docs: `cinema-booking-system/frontend/docs/API_DOCS.md`.
- FE package: `cinema-booking-system/frontend/package.json`.
- Proposed refactor doc: `cinema-booking-system/docs/architecture_refactor.md`.
- Current migration handoff: `cinema-booking-system/backend/MIGRATION_STATUS.md`.

## Run Modes
Local dev:
- Start PostgreSQL on `localhost:5432`, DB `cinema_db`, user `postgres`, password `123`.
- Start Redis on `localhost:6379`.
- Run backend from `backend_legacy`.
- Run frontend from `frontend`.

Docker:
- `cinema-booking-system/docker-compose-app.yml` exists for full app, but on this branch it may point to `./backend` rather than `./backend_legacy`; inspect/fix before relying on it.
- `cinema-booking-system/backend/infrastructure/docker-compose.yml` runs the extracted services with one PostgreSQL 18 container, logical service databases, Showtime Redis, RabbitMQ, and Neo4j. `backend/infrastructure/smoke-test.ps1 -StartCompose -StopCompose` builds, starts, verifies, and tears down the stack while retaining named data volumes.
- `backend/infrastructure/event-flow-smoke.ps1` verifies RabbitMQ-to-Analytics/Neo4j delivery, deduplication, ordering, API output, and evidence cleanup.
- `backend/infrastructure/migrations/migration-rehearsal.ps1` exercises guarded export, checksum validation, two-pass row/content/sequence reconciliation, deliberate sequence-drift rejection, and repeatable Analytics backfill against an isolated PostgreSQL fixture.
