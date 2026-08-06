# Agent Session Bootstrap

Updated: 2026-08-07

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

- Branch: `refactor-n-decoupling`.
- Complete runnable backend: `cinema-booking-system/backend_legacy/`.
- Microservice migration target: `cinema-booking-system/backend/`.
- Frontend: `cinema-booking-system/frontend/`.
- Spring-owned migration preparation is complete for Catalog, Showtime,
  Booking, Analytics, and Recommendation.
- The Spring Facility service is a compatibility slice only. Target Facility
  ownership belongs to the ASP.NET workstream.
- The product has not switched traffic or canonical data away from
  `backend_legacy`.
- Standalone Spring JWT enforcement remains disabled until teammate-owned
  Keycloak and Gateway integration passes real-token tests.
- The next work is coordinated integration and canonical snapshot rehearsal,
  not another broad Spring extraction or monolith refactor.

## Ownership Matrix

| Service/area | Target owner | Current status |
|---|---|---|
| Catalog | Spring | Migration-prepared |
| Showtime | Spring | Migration-prepared |
| Booking | Spring | Prepared; Payment outcome integration pending |
| Analytics | Spring | Migration-prepared |
| Recommendation | Spring | Migration-prepared |
| Facility | ASP.NET | Spring compatibility slice exists; keep it minimal |
| Identity/Keycloak | ASP.NET | Shared contract approved; merge pending |
| API Gateway | ASP.NET | Shared contract approved; merge pending |
| Payment | ASP.NET | Teammate Saga branch exists; envelope/Booking merge pending |
| Notification | ASP.NET | Outside the Spring workstream |
| Frontend auth/routing | Shared with teammate | Integrated Gateway flow pending |

Do not add features to ASP.NET-owned services in the Spring workstream.

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

Payment must still freeze versioned payloads for `payment.completed`,
`payment.failed`, and `payment.refunded`. Booking consumers for those outcomes
must not be guessed before the teammate-owned payload and state machine are
agreed.

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
2026-08-07. This is not a canonical cutover rehearsal. The local source is
PostgreSQL 18 while project Compose targets PostgreSQL 16, so the authoritative
source/client/target major versions must be aligned before migration.

## Latest Verification Evidence

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

- Rebase or recreate teammate branches from the latest
  `refactor-n-decoupling`; do not merge old Compose/service definitions blindly.
- Merge Keycloak and Gateway first, then pass the authentication contract's
  real-token, forged-header, `/internal/**`, key-rotation, and Google mapping
  tests.
- Integrate ASP.NET Facility while preserving the current OpenAPI projections
  and Showtime delete guards.
- Freeze Payment event payloads and implement idempotent, ordering-safe Booking
  Saga consumers and compensations.
- Resolve frontend production dependency advisories and run the complete booking
  flow through Gateway.
- Confirm canonical PostgreSQL versions and run the guarded migration twice
  against a protected copied snapshot.
- Rehearse shadow traffic, active Redis hold handling, final write delta, and
  rollback to `backend_legacy` before switching traffic.

## Safe Next Order

1. Sync teammate branches from the latest `refactor-n-decoupling`.
2. Integrate Keycloak and Gateway contracts.
3. Run real-token security tests and only then enable Spring JWT.
4. Integrate ASP.NET Facility and contract-test Showtime/Booking dependencies.
5. Freeze Payment envelopes and add Booking Saga consumers/tests.
6. Build one conflict-resolved Compose stack and run all backend, event, auth,
   Payment, and frontend flows.
7. Rehearse the canonical snapshot, archive evidence, then rehearse rollback.
8. Plan the write freeze/final delta and approve cutover.

## Task-To-Files

| Task | Read first | Then inspect only |
|---|---|---|
| General current status | `cinema-booking-system/backend/MIGRATION_STATUS.md` | Relevant unchecked gate |
| Spring service change | `cinema-booking-system/backend/README.md`, matching OpenAPI contract | That service's `src/main`, `src/test`, and `pom.xml` |
| Auth/Gateway integration | `cinema-booking-system/docs/authentication_integration_contract.md` | Five Spring security configs/tests, Gateway config, Compose env |
| Internal authentication | Auth contract Sections 9-10 | Only affected HTTP client/filter and its contract test |
| Payment/Booking Saga | Architecture Sections 8 and 11, `cinema-booking-system/backend/shared/events/` | Booking order/payment state code and teammate Payment branch |
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
