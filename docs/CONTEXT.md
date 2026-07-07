# Project Context

## Goal
Cinema Booking System is a university project for movie/event ticket booking, admin management, and staff counter operations. The practical goal is a solid, demo-ready booking management app, not production-grade microservices.

## Current Repository Shape
- `cinema-booking-system/backend_legacy/`: runnable Spring Boot modular monolith and source of truth for backend behavior.
- `cinema-booking-system/frontend/`: runnable React/Vite frontend.
- `cinema-booking-system/backend/`: microservice-refactor target. Catalog, Facility, and Showtime are now extracted Spring Boot services; other service folders are still placeholders.
- `cinema-booking-system/docs/architecture_refactor.md`: proposed future microservice architecture. Current implementation is migrating incrementally toward it.
- Root-level `docs/`: handoff docs for Codex agents.

## Runnable Architecture
The implemented app is a modular monolith backend plus SPA frontend.

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
- Database/cache: PostgreSQL 16 compatible, Redis 7.
- Frontend: React 18, Vite 5, TypeScript, Tailwind CSS, Zustand, Axios, Lucide React.
- Containers: Docker/Docker Compose files exist, but verify paths because branch layout moved runnable backend to `backend_legacy`.

## Major Decisions
- Current complete demo/backend deliverable remains the modular monolith in `backend_legacy`.
- `backend/` now contains buildable `catalog-service`, `facility-service`, and `showtime-service`; it is not yet a complete replacement for `backend_legacy`.
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

## Run Modes
Local dev:
- Start PostgreSQL on `localhost:5432`, DB `cinema_db`, user `postgres`, password `123`.
- Start Redis on `localhost:6379`.
- Run backend from `backend_legacy`.
- Run frontend from `frontend`.

Docker:
- `cinema-booking-system/docker-compose-app.yml` exists for full app, but on this branch it may point to `./backend` rather than `./backend_legacy`; inspect/fix before relying on it.
- `cinema-booking-system/backend/infrastructure/docker-compose.yml` can run the extracted Catalog, Facility, and Showtime services with separate PostgreSQL databases plus Showtime Redis.
