# Current State

For a new agent session, read `../AGENTS.md` and `SESSION_BOOTSTRAP.md` first.
This file is the detailed operational reference. Migration evidence and cutover
gates are maintained in
`../cinema-booking-system/backend/MIGRATION_STATUS.md`.

## Snapshot

- Date of this status pass: 2026-10-11.
- Evidence: static reading of branch `refactor-compose-single-postgres` at `ebdfb9d`. Tests, Compose smoke, and the browser were not re-run for this update.
- `backend_legacy` is the rollback monolith. Traffic has not been cut over.
- `backend/` now contains the microservice stack, not placeholder folders: Spring Boot Catalog, Showtime, Booking, Analytics, and Recommendation, plus ASP.NET Identity, Facility, Payment, Notification, and the YARP API Gateway. Keycloak is in Compose.
- The August 2026 verification numbers in `MIGRATION_STATUS.md` still stand as historical evidence. They do not cover the later frontend, payment, notification, gateway, and facility merges.

## Exact Repository State

- Customer, staff, and admin UI live in `cinema-booking-system/frontend/` and call `VITE_API_BASE_URL` (default `http://localhost:5000/api`) with a Keycloak bearer token.
- Spring services: `catalog-service`, `showtime-service`, `booking-service`, `analytics-service`, `recommendation-service`.
- ASP.NET services: `identity-service`, `facility-service`, `payment-service`, `notification-service`, `api-gateway`.
- `rental-service` has compiled output only. Room rental is on branch `feature/room-rental`, not here.
- `backend/infrastructure/docker-compose.yml` runs the services above against one PostgreSQL 18 container on host port `5432`. Logical databases from `init-multiple-databases.sql`: `cinema_catalog_db`, `cinema_showtime_db`, `cinema_booking_db`, `cinema_analytics_db`, `keycloak_db`, `user_profile_db`, `payment_db`, `facility_db`. Notification uses MongoDB. Showtime Redis, shared Redis, RabbitMQ, and Neo4j are separate containers.

## Feature Progress

Status means "present in this branch's source", not "re-tested on 2026-10-11" and not "cut over".

### Completed

Customer:

- Register, login, forgot-password, and logout go through Keycloak (`keycloak-js`, cinema theme, locale and theme query params).
- Movie and event browse, detail, showtimes, and catalog keyword search.
- Seat map, Redis seat hold, hold countdown, order create, voucher validation, and checkout.
- Stripe and PayPal redirect plus return verification, and cash confirmation on the payment service.
- Reviews and rating summaries are rendered on movie and event detail pages.
- My tickets, ticket detail, and PDF download.
- Personalized and popular recommendations on the home page.
- Vietnamese/English UI and light/dark theme.

Staff and admin:

- QR check-in calls `POST /api/tickets/check-in` and stops the camera after one decode (`processingRef`).
- Ticket lookup uses the ticket-by-code API. Ticket PDF download exists.
- Admin movies, events, cinemas, rooms, and seat maps call the real catalog and facility APIs.
- Admin showtimes list and delete real showtimes. Auto showtime creator publishes generated blocks through `showtimeService`.
- Admin dashboard reads analytics endpoints.
- Voucher list, create, and delete call booking-service. Role changes call `PUT /api/users/{id}/role`.
- Profile read/update uses identity `GET/PUT /api/users/me`.

Platform:

- Gateway routes public APIs, applies Keycloak policies, resolves the internal user id, and blocks `/internal/**`.
- Booking consumes `payment.completed`, `payment.failed`, and `payment.refunded` from exchange `payment.events`. Payment sets that exchange name in MassTransit.
- Payment implements `RefundAsync` for Stripe, PayPal, and cash. Integration tests exist under `PaymentService.Test/Integration`.
- Notification consumes user, order, review, and showtime events, sends email through MailKit, and maps a SignalR hub at `/hubs/notifications`.
- k6 load-test scripts exist under `cinema-booking-system/tests/load/`. Observability env vars point at an OTLP collector. The collector compose file is separate: `docker-compose.observability.yml`.

### In progress

- Seat holds refresh by polling the seat map every 5 seconds. There is no server-sent event stream.
- Home still appends local mock movies under the backend list, and empty-search suggestions mix in those mocks.
- Pricing page shows a hardcoded base rate and tiers (`getPricingOverview`) next to real vouchers. There is no voucher update API; the frontend update helper is a mock. Booking exposes GET, POST, validate, and DELETE only.
- Permission management lists real users and can change one realm role. Delete user returns success without calling Keycloak. A permission-rule catalog is mock data and is not rendered.
- Staff dashboard, today's bookings, validation stats, and counter booking call `/api/staff/**`. Those routes are not in the gateway and there is no staff controller in booking-service. Order rows do store `salesChannel` and `createdByStaffId`.
- Notification email is implemented. SMS is `DummySmsSender` (log only). The SPA has no notification inbox and no SignalR client. The gateway does not route `/api/notifications` or the hub.
- Spring services still default `CINEMA_SECURITY_JWT_ENABLED` to `false`. Gateway auth can be on while the Spring services are not enforcing JWTs.
- Membership is a static "coming soon" page.
- Canonical snapshot migration, shadow traffic, and rollback rehearsal are still open. See `MIGRATION_STATUS.md`.

### Not done

- In-app notification inbox.
- A real SMS provider.
- Real-time seat-map push (SSE or equivalent).
- Staff aggregate APIs and a counter-booking endpoint on the gateway.
- Membership product.
- Deleting a user from Keycloak.
- Admin pricing rules and voucher edit.
- Fine-grained permission rules beyond the three realm roles.
- Room rental on this branch.
- Traffic cutover away from `backend_legacy`.
- A fresh full-stack test of gateway, payment saga, notification email, and the booking UI together. The last recorded Spring smoke is 2026-08-07, before these merges.
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
- Migration export now checks legacy relational invariants and writes a SHA-256 manifest; restore validates compatibility/checksums before mutation, and reconciliation compares row counts, content fingerprints, and owned ID-sequence state.
- A disposable PostgreSQL rehearsal passed two restore/reconciliation cycles, two Analytics backfills, tampered-dump rejection, and deliberate stale-sequence rejection/repair on 2026-08-07.
- The current local development `cinema_db` also passed two restore/content/sequence reconciliation cycles and two Analytics backfills against disposable PostgreSQL 18 targets. This was a local-data audit, not the canonical cutover rehearsal.
- Static contract tests now guard Spring Boot client paths against the OpenAPI drafts for Catalog, Facility, Showtime, and Booking.
- Spring context tests protect JPA repository scanning, constructor injection, Redis typing, and AMQP queue binding; a packaged-runtime regression test protects Spring MVC parameter metadata.
- The extracted backend now has 179 passing tests. The 2026-08-07 verification
  ran all six service modules, including JWT validators/route policies,
  authenticated `user_id` binding, booking ownership, and seat-hold ownership.
- All six Docker images build as executable non-root Java 21 images. The full Compose stack, expanded runtime smoke, and RabbitMQ/Neo4j event-flow suite passed locally on 2026-08-07, then the stack was stopped while named data volumes were retained.
- Frontend `npm ci` and the Vite production build passed on 2026-08-07. Production dependency audit still reports 6 advisories, and `@zxing/library@0.22.0` declares Node 24 or newer while the verified environment used Node 22.16.0.
- The bullets above through the 179-test and six-image smoke are the 2026-08-07 record. They predate the merged gateway, payment, notification, and ASP.NET facility work.
- Backend CI still enforces `mvn clean verify`, Compose and PowerShell validation, migration dry-runs, and the RabbitMQ-to-Analytics/Neo4j event-flow test for the Spring modules.
- Identity, Facility, Payment, Notification, and the API Gateway are implemented on this branch. Change them through their contracts. Do not treat them as out of scope.

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
npm ci
npm run build
npm audit --omit=dev
```

## Runtime Ports

- Shared PostgreSQL 18: `localhost:5432`. Logical databases:
  `cinema_catalog_db`, `cinema_showtime_db`, `cinema_booking_db`,
  `cinema_analytics_db`, `keycloak_db`, `user_profile_db`, `payment_db`,
  `facility_db`.
- Legacy backend DB (when `backend_legacy` or a local `my-postgres` is used
  instead of extracted Compose): `localhost:5432/cinema_db`. Do not run both
  stacks on `5432` at the same time.
- API gateway: `localhost:5000`. Frontend default base is `http://localhost:5000/api`.
- Keycloak: `localhost:8080`, realm `cinema-booking`, client `cinema-frontend`.
- Identity service: `localhost:5001`. Database `user_profile_db`.
- Facility service: `localhost:5002`, health `/health`. Database `facility_db`.
- Payment service: `localhost:5003`. Database `payment_db`.
- Notification service: `localhost:5004`. MongoDB `localhost:27017`.
- Catalog service: `localhost:8081`.
- Showtime service: `localhost:8082`, Redis `localhost:6380`.
- Booking service: `localhost:8083`.
- Analytics service: `localhost:8084`.
- Recommendation service: `localhost:8085`.
- RabbitMQ: `localhost:5672`, management UI `localhost:15672`.
- Neo4j: browser `localhost:7474`, Bolt `localhost:7687`.
- Shared Redis: `localhost:6379`.
- Frontend dev server: `localhost:5173`.

## Seed/Test Accounts

From `backend_legacy/src/main/resources/FE_SEED_DATA_REFERENCE.md`:

- Admin: `admin@cinema.com` / `admin123`.
- Staff: `staff@cinema.com` / `staff123`.
- Customer: `customer@cinema.com` / `customer123`.
- Locked customer: `locked@cinema.com` / `locked123`.

## Known Verification Gaps

- This 2026-10-11 pass did not re-run Maven, the frontend build, Compose smoke, the payment saga, or a browser booking. Treat feature rows above as code inspection.
- Frontend production dependency advisories and the `@zxing/library` Node 24 declaration were last recorded on 2026-08-07 (Node 22.16.0, 6 advisories). They were not rechecked.
- Data backfill has not been executed against an approved canonical snapshot.
- August runtime and event-flow smokes covered the six Spring services only. They do not prove the later gateway, payment, notification, and ASP.NET facility stack.
- Booking payment consumers are in code and Compose sets `BOOKING_PAYMENT_EVENTS_ENABLED=true`. Payment's MassTransit entity name is `payment.events`. A live complete/fail/refund run on this merged branch was not repeated here.
- Gateway code validates JWTs and blocks `/internal/**`. Spring JWT remains off by default. The authentication contract's real-token suite was not re-run.
- Notification is not reachable through the gateway. SMS does not leave the process.
- Staff dashboard and counter booking UI call routes the gateway does not own.
- OTLP endpoints are configured. Multi-host discovery and a production trace backend are not.

## Suggested Next Steps

1. Run one Compose stack and a real customer booking: Keycloak login, seat hold, Stripe or cash payment, booking state change, and notification email.
2. Add gateway routes for notification HTTP and the SignalR hub, or drop the unused inbox until that exists.
3. Replace `/api/staff/**` with booking endpoints the gateway already routes, including counter booking.
4. Remove homepage mock movies, the pricing mock, and the fake user-delete success.
5. Pass the authentication contract suite, then set `CINEMA_SECURITY_JWT_ENABLED=true`.
6. Rehearse the canonical PostgreSQL 18 snapshot and rollback before any traffic cutover.
