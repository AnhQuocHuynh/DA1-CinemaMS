# Agent Session Bootstrap

Updated: 2026-10-11

Purpose: give a new agent enough current context to continue safely without
scanning the repository or rereading the full architecture document.

## Startup Protocol

Read only these files before deciding what else is needed:

1. `AGENTS.md` for durable repository and collaboration rules.
2. This file for the current system snapshot and task routing.

Then run:

```powershell
git status --short --branch
git log --oneline --decorate --max-count=8
```

Do not scan the whole codebase. Select the task category in `Task-To-Files`
and read only the listed contract, module, and tests. Read
`docs/CONTEXT.md` or `docs/CURRENT_STATE.md` only when the task needs their
stable product context, ports, accounts, or command reference.

If Git shows unexpected changes, stop before editing and follow `AGENTS.md`.

## Source Of Truth

Use this precedence when documents overlap:

1. The user's newest instruction controls the current task.
2. `AGENTS.md` controls durable repository rules and ownership boundaries.
3. Executable code and tests control current implemented behavior.
4. Approved OpenAPI, event, and authentication contracts control integration
   behavior that multiple workstreams must share.
5. `cinema-booking-system/backend/MIGRATION_STATUS.md` controls migration
   readiness, evidence, blockers, and cutover gates.
6. This file is the concise session entry point.
7. `docs/CURRENT_STATE.md` is the detailed operational snapshot.
8. `docs/CONTEXT.md` contains stable product and modular-monolith background.
9. `cinema-booking-system/docs/architecture_refactor.md` is the target design,
   not proof that a feature has already been implemented.

When code and an approved cross-team contract disagree, do not silently choose
one. Inspect the narrow implementation, report the mismatch, and preserve the
contract unless the team explicitly changes it.

## Current Snapshot

- Branch: `refactor-compose-single-postgres` (`ebdfb9d` at the 2026-10-11 read).
- Rollback monolith: `cinema-booking-system/backend_legacy/`.
- Microservice stack: `cinema-booking-system/backend/`.
- Frontend: `cinema-booking-system/frontend/`, Keycloak PKCE, gateway base URL.
- Spring services in tree: Catalog, Showtime, Booking, Analytics, Recommendation.
- ASP.NET services in tree: Identity, Facility, Payment, Notification, API Gateway.
- Keycloak, one PostgreSQL 18 container, Redis, RabbitMQ, Neo4j, and MongoDB are in Compose.
- Traffic and the canonical database have not moved off `backend_legacy`.
- Spring `CINEMA_SECURITY_JWT_ENABLED` still defaults to `false`.
- The 2026-10-11 feature matrix is in `docs/CURRENT_STATE.md`. It is a code
  inspection. August smoke results were not re-run.
- Next work is to close the staff, notification-gateway, mock-UI, and live
  payment/auth gaps, then rehearse the canonical snapshot. Do not start another
  broad extraction.

## Ownership Matrix

| Service/area | Owner | Current status |
|---|---|---|
| Catalog | Spring | In this branch. Migration rehearsal evidence is from 2026-08-07 |
| Showtime | Spring | In this branch. Seat hold is Redis plus frontend polling |
| Booking | Spring | Payment consumers implemented. No `/api/staff/**` controller |
| Analytics | Spring | Admin dashboard read model |
| Recommendation | Spring | Wired to the home page |
| Facility | ASP.NET | Cinema, room, and seat-template APIs on this branch |
| Identity/Keycloak | ASP.NET + Keycloak | Login UI uses Keycloak. User delete is not implemented |
| API Gateway | ASP.NET | Routes catalog, facility, showtime, booking, analytics, recommendation, payment, and users. No notification or `/api/staff/**` routes |
| Payment | ASP.NET | Stripe, PayPal, cash, refunds. Publishes to `payment.events` in code |
| Notification | ASP.NET | Email and event consumers. SMS is a log stub. Not on the gateway |
| Frontend | React | Most use cases call real APIs. See the feature matrix for mocks |

ASP.NET services on this branch are in scope. Keep their HTTP and event contracts stable.

## Implemented Boundaries

- Catalog calls Showtime internal event commands instead of direct Showtime
  repositories.
- Showtime reads Catalog and Facility through internal HTTP projections.
- Booking uses Showtime seat-reservation commands and Catalog/Facility
  projections instead of cross-module repositories.
- Facility delete guards query Showtime and fail closed when it is unavailable.
- Internal endpoints use `/internal/**`.
- Transitional internal header is exactly `X-Internal-Token`, configured by
  `INTERNAL_API_TOKEN`.
- Catalog and Booking publish through transactional outboxes with RabbitMQ
  confirms, mandatory routing, bounded retry, and terminal failure state.
- Analytics and Recommendation consume versioned events idempotently and guard
  stale order transitions.

## Shared Contracts

### Authentication

Canonical contract:
`cinema-booking-system/docs/authentication_integration_contract.md`.

Required application roles are `ADMIN`, `STAFF`, and `CUSTOMER`. `USER` is not
canonical. Public services validate Keycloak signature, exact issuer, audience,
expiry, and not-before time. User-owned operations bind to signed numeric
`user_id`, not caller-controlled headers or payload values.

Spring JWT support is implemented behind:

- `CINEMA_SECURITY_JWT_ENABLED`
- `KEYCLOAK_ISSUER_URI`
- `KEYCLOAK_AUDIENCE`
- optional `KEYCLOAK_JWK_SET_URI`

Do not enable it in the integrated deployment until Gateway forwards the
original bearer token, strips spoofable headers, blocks `/internal/**`, and the
real-token security suite passes.

The target internal mechanism is least-privilege Keycloak client credentials.
`X-Internal-Token` remains a temporary compatibility mechanism only.

### Events

Canonical envelope:

```json
{
  "eventId": "uuid",
  "eventType": "order.paid",
  "occurredAt": "RFC-3339 timestamp",
  "schemaVersion": 1,
  "source": "booking-service",
  "payload": {}
}
```

Consumers deduplicate by `eventId`. Incompatible payload changes require a new
schema version/routing contract. Do not accept a raw MassTransit payload as the
cross-framework contract.

Current Spring event definitions are under
`cinema-booking-system/backend/shared/events/`.

Booking consumes version 1 `payment.completed`, `payment.failed`, and
`payment.refunded` envelopes when `BOOKING_PAYMENT_EVENTS_ENABLED=true`.
Contract: `cinema-booking-system/backend/shared/events/payment-events.md`.
Teammate test notes:
`cinema-booking-system/docs/booking_status.md`.
Payment must publish to exchange `payment.events` with those routing keys;
MassTransit type-name exchanges are not consumed.

### Data Migration

Migration runbook:
`cinema-booking-system/backend/infrastructure/migrations/README.md`.

Guards already implemented:

- Read-only source invariant checks.
- SHA-256 manifest before target mutation.
- PostgreSQL client/target compatibility check.
- Transactional restore with explicit destructive confirmation.
- Row-count and order-independent content fingerprint reconciliation.
- Owned ID-sequence equality and next-value headroom validation.
- Repeatable Analytics backfill.
- Tampered-dump and stale-sequence negative rehearsals.

The fixture and current local development data passed two restore cycles on
2026-08-07. This is not a canonical cutover rehearsal. Extracted Compose now
targets PostgreSQL 18 on host port `5432`, matching the audited local source
major. Restore and verify scripts default to that single host port; pass
per-service ports only if an older multi-container layout is still running.

## Latest Verification Evidence

Recorded 2026-08-07 for the Spring services. Not repeated after the gateway,
payment, notification, and frontend merges.

- Extracted backend `mvn clean verify`: 179 tests, 0 failures, 0 errors, 0
  skipped across 58 Surefire reports.
- Six Spring Docker images rebuilt and verified as non-root `appuser` images.
- Full runtime smoke passed for health, API envelopes, RabbitMQ topology, and
  internal-token guards.
- Event-flow smoke passed for duplicate delivery, stale-event ordering,
  Analytics, Neo4j, Recommendation API state, and cleanup.
- Fixture migration rehearsal passed two restore/reconciliation cycles, two
  Analytics backfills, checksum tamper rejection, and sequence-drift rejection.
- Local development database passed equivalent two-cycle row, content, sequence,
  and Analytics checks on disposable PostgreSQL 18 targets.
- Frontend production build passed.
- Frontend still has 6 production dependency advisories: 1 low, 3 moderate, 2
  high. `@zxing/library@0.22.0` declares Node `>=24`; the verified environment
  used Node 22.16.0.
- Test containers and local-data dump artifacts were removed after verification.

For detailed evidence and all cutover gates, read
`cinema-booking-system/backend/MIGRATION_STATUS.md`.

## Remaining Gates

- Keycloak, Gateway, Facility, Payment, and Notification source are already on
  this branch. Do not merge an older multi-Postgres Compose over it.
- Pass the authentication contract's real-token, forged-header, `/internal/**`,
  key-rotation, and Google mapping tests before enabling Spring JWT.
- Prove Facility projections and Showtime delete guards against the ASP.NET
  service, not the removed Spring slice.
- Run the Booking consumer matrix against Payment's `payment.events` publish
  path on this branch.
- Route notification HTTP and SignalR, or leave them unused on purpose.
- Replace staff dashboard and counter-booking calls that target missing
  `/api/staff/**` routes.
- Resolve frontend production dependency advisories and run one booking through
  the gateway.
- Run the guarded migration twice against a protected copied PostgreSQL 18
  snapshot, then rehearse rollback to `backend_legacy`.

## Safe Next Order

1. Boot the current Compose stack and complete one customer booking through the gateway.
2. Fix staff and notification route gaps found by that run.
3. Run real-token security tests and only then enable Spring JWT.
4. Run the Payment consumer matrix (complete / fail / refund / duplicate / poison).
5. Remove user-visible mocks: homepage movies, pricing tiers, fake user delete.
6. Rehearse the canonical snapshot, archive evidence, then rehearse rollback.
7. Plan the write freeze and approve cutover only after those gates have fresh evidence.

## Task-To-Files

| Task | Read first | Then inspect only |
|---|---|---|
| General current status | `cinema-booking-system/backend/MIGRATION_STATUS.md` | Relevant unchecked gate |
| Spring service change | `cinema-booking-system/backend/README.md`, matching OpenAPI contract | That service's `src/main`, `src/test`, and `pom.xml` |
| Auth/Gateway integration | `cinema-booking-system/docs/authentication_integration_contract.md` | Five Spring security configs/tests, Gateway config, Compose env |
| Internal authentication | Auth contract Sections 9-10 | Only affected HTTP client/filter and its contract test |
| Payment/Booking Saga | `cinema-booking-system/docs/booking_status.md`, `backend/shared/events/` | `payment-service` publish topology and `booking-service` consumers |
| ASP.NET Facility integration | Facility OpenAPI contract | Showtime/Booking Facility clients and Spring compatibility tests |
| Data migration | `cinema-booking-system/backend/infrastructure/migrations/README.md` | Scripts in that directory and target schemas only |
| Runtime/Compose failure | `cinema-booking-system/backend/README.md` | Compose file, affected service config, smoke script |
| Event failure | `cinema-booking-system/backend/shared/events/README.md` | Producer outbox, affected consumer, event-flow smoke |
| Legacy behavior regression | `docs/CONTEXT.md`, legacy API docs | Only the matching `backend_legacy` module and tests |
| Frontend integration | `cinema-booking-system/frontend/docs/API_DOCS.md`, `cinema-booking-system/frontend/package.json` | Matching service/page/store and Gateway route |
| Architecture decision | Relevant architecture section only | Approved contract and current implementation evidence |

## Verification Commands

From the workspace root:

```powershell
cd cinema-booking-system\backend
..\..\.codex-tools\apache-maven-3.9.9\bin\mvn.cmd clean verify
docker compose -f infrastructure\docker-compose.yml config
.\infrastructure\event-flow-smoke.ps1 -StartCompose -StopCompose
.\infrastructure\migrations\migration-rehearsal.ps1
```

Frontend:

```powershell
cd cinema-booking-system\frontend
npm ci
npm run build
npm audit --omit=dev
```

Choose verification proportional to the files changed. Do not start full Docker
for a documentation-only task.

## Session Handoff Rules

Update this file only when the top-level ownership, readiness verdict, next
integration order, or required startup reading changes.

Update `docs/CURRENT_STATE.md` when operational facts, commands, ports, or known
gaps change. Update `backend/MIGRATION_STATUS.md` when migration evidence,
blockers, or cutover gates change. Update approved contracts only after the
cross-workstream decision changes.

At the end of a coding session, report tests actually run, tests not run, Git
state, remaining external dependencies, and the next safe task. Never claim a
traffic cutover from a successful local rehearsal.
