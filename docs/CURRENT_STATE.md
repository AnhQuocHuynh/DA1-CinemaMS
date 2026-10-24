# Current State

For a new agent session, read `../AGENTS.md` and `SESSION_BOOTSTRAP.md` first.
This file is the detailed operational reference. Migration evidence and cutover
gates are maintained in
`../cinema-booking-system/backend/MIGRATION_STATUS.md`.

## Snapshot

- Date of this status pass: 2026-10-11.
- Evidence: code inspection of `refactor-compose-single-postgres` at `ebdfb9d`, plus the local test and Compose run recorded below. The browser booking flow was not exercised.
- `backend_legacy` is the rollback monolith. Traffic has not been cut over.
- `backend/` now contains the microservice stack, not placeholder folders: Spring Boot Catalog, Showtime, Booking, Analytics, and Recommendation, plus ASP.NET Identity, Facility, Payment, Notification, and the YARP API Gateway. Keycloak is in Compose.
- The August 2026 verification numbers in `MIGRATION_STATUS.md` still stand as historical evidence. They do not cover the later frontend, payment, notification, gateway, and facility merges.

## Verification on 2026-10-11

Local run on this machine. This is not a cutover and not an event-flow smoke. The stack was left running.

- Spring `mvn -B clean verify` from `cinema-booking-system/backend`: BUILD SUCCESS. 180 tests, 0 failures: catalog 30, showtime 40, booking 70, analytics 15, recommendation 25. This is the current five-module reactor. It is a different suite from the 2026-08-07 count of 179.
- Frontend `npm ci` then `npm run build`: exit 0. Vite warned that the main chunk is over 500 kB. `@zxing/library@0.22.0` wants Node 24; this machine is Node 22.16.0. `npm audit` reported 23 vulnerabilities. They were not changed.
- Keycloak SPI `mvn -B -DskipTests package` produced `infrastructure/keycloak-spi/target/rabbitmq-event-listener.jar`.
- ASP.NET `dotnet test`: notification 135 passed. Facility 46 passed, 17 failed. Identity 89 passed, 5 failed. Payment 59 passed, 4 failed. The gateway project has no tests and the `dotnet test` invocation exited 0. Facility integration failures are `RedisConnectionException` from `Program.cs` line 35 while the Testcontainers host starts. Identity failures are 401 on current-user routes plus one admin list that cannot deserialize `gender`. Payment failures: missing-payment-id callback did not throw, `status` deserialized as a string instead of `Int32`, a refund saga stayed `Completed`, and an admin refund returned HTTP 502.
- `docker compose up --build -d` built the service images and started the stack. An old stopped container named `cinema-redis` (exited about three months earlier, not part of this Compose project) blocked the first start. That container was removed. Its anonymous Redis volume was left in place. Facility and identity then exited on the first boot because Postgres was not accepting connections yet. After `docker compose start` they answered HTTP 200 on `/health`.
- `infrastructure/smoke-test.ps1` passed catalog `/actuator/health`, then stopped: facility exposes `/health`, and `http://localhost:5002/actuator/health` is HTTP 404. The script never reached the later checks.
- The same later checks, run by hand against the live stack: showtime, booking, analytics, and recommendation actuator health returned 200. Gateway, identity, facility, payment, and notification `/health` returned 200. Keycloak realm `cinema-booking` returned 200. Analytics overview and both recommendation reads returned a success envelope. All 14 queues named by the smoke script exist on RabbitMQ (25 queues total). Internal routes without `X-Internal-Token` returned 401. With the token, facility room, facility seats, and the showtime room guard returned 200. Catalog movie and event projections returned 404 for id 1, which the smoke script treats as an accepted token. Payment saga, notification email, and the booking UI were not exercised.

## Exact Repository State

- Customer, staff, and admin UI live in `cinema-booking-system/frontend/` and call `VITE_API_BASE_URL` (default `http://localhost:5000/api`) with a Keycloak bearer token.
- Spring services: `catalog-service`, `showtime-service`, `booking-service`, `analytics-service`, `recommendation-service`.
- ASP.NET services: `identity-service`, `facility-service`, `payment-service`, `notification-service`, `api-gateway`.
- `rental-service` has compiled output only. Room rental is on branch `feature/room-rental`, not here.
- `backend/infrastructure/docker-compose.yml` runs the services above against one PostgreSQL 18 container on host port `5432`. Logical databases from `init-multiple-databases.sql`: `cinema_catalog_db`, `cinema_showtime_db`, `cinema_booking_db`, `cinema_analytics_db`, `keycloak_db`, `user_profile_db`, `payment_db`, `facility_db`. Notification uses MongoDB. Showtime Redis, shared Redis, RabbitMQ, and Neo4j are separate containers. The same file starts `cinema-frontend` (Nginx) on host port `5173`.

## Feature Progress

Status means the feature is present in this branch's source. The 2026-10-11 test run is in the verification section above. Traffic has not been cut over.

### Completed

Customer:

- Register, login, forgot-password, and logout go through Keycloak (`keycloak-js`, cinema theme, locale and theme query params).
- Movie and event browse, detail, showtimes, and catalog keyword search.
- Seat map, seat hold, hold countdown, order create, voucher validation, and checkout. The hold uses Redis. If Redis is unavailable, showtime-service locks the `showtime_seats` row and stores `held_by_user_id` plus `hold_expires_at`. A hold with no remaining time is shown as available again.
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
- Instructor roadmap, not started on this branch. The plan is `docs/ROADMAP.md`.
  - Content search: Catalog already matches title or description with `LIKE`. Full-text ranking, a plot snippet, and removal of home mock suggestions are still open.
  - Room rental: implemented on `origin/feature/room-rental` (`4b03fb8`) as `rental-service`, with no frontend. Do not merge that branch wholesale.
  - Supplementary-feature analysis report and the admin rental report screen are not written yet.
  - Mobile layout still breaks on the seat map, checkout, staff scanner, and admin sidebar.

### Not done

- In-app notification inbox.
- A real SMS provider.
- Real-time seat-map push (SSE or equivalent).
- Staff aggregate APIs and a counter-booking endpoint on the gateway.
- Membership product.
- Deleting a user from Keycloak.
- Admin pricing rules and voucher edit.
- Fine-grained permission rules beyond the three realm roles.
- Room rental on this branch. See `docs/ROADMAP.md`.
- Traffic cutover away from `backend_legacy`.
- An end-to-end booking through the gateway, a live payment saga, notification email delivery, and the booking UI together. The 2026-10-11 health and read-model checks do not cover that path.

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
- Frontend: container `cinema-frontend` on `localhost:5173`. `npm run dev` uses the same port, so run only one of them.

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

Feature work follows `docs/ROADMAP.md`: content search, then a selective port of
room rental, then the analysis report, then the mobile layout pass.

Cutover work is unchanged:

1. Run one Compose stack and a real customer booking through the gateway.
2. Add gateway routes for notification HTTP and the SignalR hub, or leave the inbox unused.
3. Replace `/api/staff/**` with routes the gateway already owns.
4. Remove homepage mock movies, the pricing mock, and the fake user-delete success.
5. Pass the authentication contract suite, then set `CINEMA_SECURITY_JWT_ENABLED=true`.
6. Rehearse the canonical PostgreSQL 18 snapshot and rollback before any traffic cutover.
