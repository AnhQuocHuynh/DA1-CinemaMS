# Backend Migration Status

Updated: 2026-08-07

## Executive Decision

The repository-controlled work for the Spring-owned services is complete and
ready for coordinated integration. Catalog, Showtime, Booking, Analytics, and
Recommendation can be built, tested, containerized, and migrated independently.
The current local development data also passed a guarded two-cycle restore.

This does **not** mean the product is ready for traffic cutover. The remaining
work is cross-workstream integration with the teammate-owned Keycloak/Gateway,
Facility, and Payment services, followed by a rehearsal against the canonical
copied database snapshot and an approved traffic/rollback procedure.

Until those gates pass:

- `backend_legacy` remains the complete runnable backend and rollback source.
- `CINEMA_SECURITY_JWT_ENABLED` remains `false` in the standalone Spring stack.
- Public traffic must not be routed directly to extracted service ports.
- No canonical database or production write traffic has been migrated.

## Ownership Boundary

| Area | Owner/workstream | Current position |
|---|---|---|
| Catalog | Spring | Migration-prepared |
| Showtime | Spring | Migration-prepared |
| Booking | Spring | Migration-prepared; Payment event integration pending |
| Analytics | Spring | Migration-prepared |
| Recommendation | Spring | Migration-prepared |
| Facility | ASP.NET teammate | Spring folder is compatibility-only; do not expand it |
| Identity/Keycloak | ASP.NET teammate | Contract agreed; integration pending |
| API Gateway | ASP.NET teammate | Contract agreed; integration pending |
| Payment | ASP.NET teammate | Saga implementation exists on teammate branch; envelope/Booking integration pending |
| Notification | ASP.NET teammate | Outside the current Spring scope |

## Spring Deliverables Complete

- Six extracted applications build independently: Catalog, compatibility
  Facility, Showtime, Booking, Analytics, and Recommendation.
- Catalog, Showtime, Booking, and compatibility Facility communicate through
  explicit HTTP boundaries rather than cross-service repositories/entities.
- Internal HTTP routes use `/internal/**` and the transitional canonical header
  `X-Internal-Token`; clients fail closed when required dependencies are down.
- Catalog and Booking use transactional outboxes with publisher confirms,
  mandatory routing, bounded retries, and terminal failed-event state.
- Analytics and Recommendation consume versioned envelopes idempotently, reject
  stale order transitions, retry transient failures, and dead-letter permanent
  failures.
- Recommendation has guarded legacy graph backfill; Analytics has repeatable
  read-model backfill.
- Migration tooling checks source relational invariants, PostgreSQL client/server
  compatibility, SHA-256 manifests, transactional restore, row counts,
  order-independent content fingerprints, and owned sequence state.
- Migration commands tolerate valid PostgreSQL `NOTICE` output when logs are
  redirected on Windows PowerShell, while non-zero native exit codes still fail
  closed.
- Docker images run Java 21 as a non-root `appuser`.
- CI covers clean Maven verification, Compose validation, migration dry-runs,
  disposable migration rehearsal, and RabbitMQ/Neo4j event flow.

## Authentication Readiness

The agreed contract is
`../docs/authentication_integration_contract.md`. Spring implementation is
present in Catalog, Showtime, Booking, Analytics, and Recommendation.

Implemented behind `CINEMA_SECURITY_JWT_ENABLED`:

- OAuth2 Resource Server validation of JWKS signature, exact issuer, required
  audience, expiry, and not-before time.
- Optional `KEYCLOAK_JWK_SET_URI` backchannel while preserving canonical issuer
  validation.
- Canonical Keycloak roles `ADMIN`, `STAFF`, and `CUSTOMER`, mapped to Spring
  `ROLE_*`; `USER` and Keycloak system roles are ignored.
- Signed numeric `user_id` binding for orders, reviews, tickets, Showtime seat
  holds, and personalized recommendations.
- Booking ownership checks for pay, refund, and ticket reads.
- Rejection of conflicting caller-supplied identity values in JWT mode.

Activation still requires the teammate-owned stack to provide all of the
following in one integrated environment:

- Stable canonical issuer and backend audience.
- Numeric `user_id` claim or the approved idempotent UUID-to-Long provisioning
  flow.
- Gateway validation of the bearer token and forwarding of the original
  `Authorization` header.
- Removal of spoofable `X-User-*`, role, and internal-token headers.
- Complete blocking of public `/internal/**` routes.
- Real-token tests for role mapping, forged headers, key rotation, and Google
  identity mapping.

`X-Internal-Token` is transitional only. The target is least-privilege Keycloak
client-credentials tokens per calling service; this migration must be done one
caller at a time after the integrated Keycloak/Gateway baseline is stable.

## Verification Evidence: 2026-08-07

| Gate | Result | Evidence |
|---|---|---|
| Extracted backend clean verification | PASS | `mvn clean verify`: 179 tests, 0 failures, 0 errors, 0 skipped across 58 Surefire reports |
| Frontend dependency install | PASS with warnings | `npm ci` completed on Node 22.16.0; `@zxing/library@0.22.0` declares Node `>=24` |
| Frontend production build | PASS | TypeScript and Vite 5.4.21 built 2,352 modules |
| Frontend production audit | ACTION REQUIRED | `npm audit --omit=dev`: 6 vulnerabilities: 1 low, 3 moderate, 2 high |
| Compose build | PASS | All six current Spring images rebuilt from this branch |
| Container user | PASS | All six service images report `appuser` |
| Runtime smoke | PASS | Six health endpoints, response envelopes, RabbitMQ topology, and internal-token guards |
| Event-flow smoke | PASS | Duplicate delivery, stale paid-after-refund ordering, Analytics projection, Neo4j projection, API state, and evidence cleanup |
| Fixture migration rehearsal | PASS | Two restores, two Analytics backfills, 14 row/content/sequence reconciliations, tampered dump rejection, and deliberate sequence-drift rejection/repair |
| Local dev DB migration audit | PASS | Two restores and two Analytics backfills against disposable PostgreSQL 18 targets; rows, content fingerprints, and sequences matched |
| Native command failure behavior | PASS | PostgreSQL notices no longer produce false failure under redirected logs; connection failure still aborts the export |
| Cleanup | PASS | Audit containers and temporary dumps removed; local `my-postgres` returned to its original stopped state |

Frontend warnings were not auto-fixed because the teammate has an active
frontend/auth branch and an unreviewed dependency rewrite would create conflict
and regression risk. They are release gates, not ignored findings. The current
bundle also reports a JavaScript chunk above 500 kB and an approximately 8 MB
background PNG; these are performance follow-ups rather than migration-data
blockers.

## Local Development Data Audit

The audited source was the existing local `cinema_db` in the `my-postgres`
container. It is development data, not the canonical cutover snapshot.

| Service data | Table | Rows |
|---|---|---:|
| Catalog | `genres` | 0 |
| Catalog | `movies` | 11 |
| Catalog | `movie_genres` | 0 |
| Catalog | `events` | 1 |
| Facility compatibility | `cinemas` | 11 |
| Facility compatibility | `rooms` | 12 |
| Facility compatibility | `seat_types` | 3 |
| Facility compatibility | `seat_templates` | 173 |
| Showtime | `showtimes` | 19 |
| Showtime | `showtime_seats` | 258 |
| Booking | `vouchers` | 2 |
| Booking | `orders` | 6 |
| Booking | `tickets` | 7 |
| Booking | `reviews` | 0 |

The repeatable Analytics result was 6 orders, 19 showtimes, 258 showtime seats,
12 content records, 12 rooms, and 16 users.

The source container currently uses PostgreSQL 18, while the project Compose
target is PostgreSQL 16. The audit therefore used disposable PostgreSQL 18
targets to respect the compatibility guard. Before the canonical rehearsal,
the team must confirm the authoritative source major version and align client
and target versions. Do not bypass the version guard. If the canonical source
is PostgreSQL 18, either approve PostgreSQL 18 targets or design and test an
explicit downgrade-compatible logical migration.

Local dump files and credentials were not retained. For the canonical rehearsal,
archive the manifest, checksums, reconciliation output, and approved rollback
point in the team's protected evidence location.

## Service Matrix

| Service | Status | Remaining external dependency |
|---|---|---|
| `catalog-service` | Ready for coordinated migration | Gateway/Keycloak activation and canonical data snapshot |
| `showtime-service` | Ready for coordinated migration | Gateway/Keycloak activation, Redis hold cutover plan, and canonical snapshot |
| `booking-service` | Ready for integration, not final cutover | Payment outcome consumers/Saga contract, Gateway/Keycloak, and canonical snapshot |
| `analytics-service` | Ready for coordinated migration | Identity data/event integration and canonical backfill |
| `recommendation-service` | Ready for coordinated migration | Canonical graph backfill and integrated user identity |
| `facility-service` | Compatibility slice only | Replace/route to teammate-owned ASP.NET Facility after parity checks |

## Cross-Workstream Contracts Still Pending

### Auth and Gateway

The teammate should branch or rebase from the latest `refactor-n-decoupling`
before integration. The existing remote auth/gateway branch was created from an
older base and should not be merged blindly over the Spring extraction.

Merge Keycloak and Gateway first, then run every security test in Section 14 of
the authentication contract. Only after those tests pass should
`CINEMA_SECURITY_JWT_ENABLED=true` be enabled in the integrated deployment.

### Internal Authentication

- Keep the current header name exactly `X-Internal-Token` during compatibility.
- Do not add or retain `X-Internal-Api-Key` as a second contract.
- Gateway must strip this header from external requests and block `/internal/**`.
- Replace shared-token callers incrementally with client credentials after the
  public JWT integration is stable.

### Payment and Booking Saga

The shared Spring event envelope is:

```json
{
  "eventId": "uuid",
  "eventType": "payment.completed",
  "occurredAt": "RFC-3339 timestamp",
  "schemaVersion": 1,
  "source": "payment-service",
  "payload": {}
}
```

MassTransit must publish this envelope rather than a raw payload. Before merging
Payment, freeze JSON field names and semantics for `payment.completed`,
`payment.failed`, and `payment.refunded`, including `orderId`, payment/reference
ID, amount, currency, provider status/reason, and event timestamp.

Booking does not yet consume those three Payment outcomes. The integrated Saga
must be idempotent by `eventId`, reject stale state transitions, and define:

- Completed: mark the correct order paid, confirm seats, and emit the existing
  `order.paid` envelope exactly once.
- Failed: cancel/fail the order and release only that order's held seats.
- Refunded: mark the order refunded, release/adjust downstream state, and emit
  `order.refunded` exactly once.
- Duplicate or reordered Payment events: no duplicate ticket, seat, refund, or
  downstream event effects.

Do not implement guessed Booking consumers before the teammate's Payment payload
and state machine are frozen. That is the final contract-dependent coding task.

### Facility

The Spring Facility folder exists only to keep the extracted stack testable. The
teammate-owned ASP.NET Facility remains the target implementation. Integration
must preserve the current public/internal OpenAPI behavior needed by Showtime
and Booking, especially room/cinema projections and future-showtime delete
guards. Avoid parallel feature development in the Spring compatibility slice.

## Safe Integration and Cutover Order

1. Push/rebase teammate work from the latest `refactor-n-decoupling`; resolve
   Compose ownership without replacing Spring service definitions.
2. Merge Keycloak and Gateway; freeze issuer, audience, roles, claims, route
   policies, header stripping, and `/internal/**` blocking.
3. Enable Spring JWT only in the integrated environment and pass the complete
   real-token security suite, including key rotation and Google login mapping.
4. Integrate ASP.NET Facility and run contract plus Booking/Showtime dependency
   tests before removing the compatibility route.
5. Freeze the Payment envelope/payload/state machine, implement Booking outcome
   consumers, and pass duplicate/out-of-order Saga tests.
6. Produce one conflict-resolved integrated Compose stack and rerun clean build,
   runtime smoke, event flow, auth flow, Payment Saga, and frontend booking flow.
7. Confirm the canonical PostgreSQL version; take a protected read-only copy and
   run the guarded export/restore/backfill twice on disposable targets.
8. Archive checksums, content/sequence reconciliation, graph/read-model counts,
   and test logs. Any mismatch stops the migration.
9. Rehearse rollback and shadow/read traffic while `backend_legacy` remains
   available.
10. Schedule a write freeze, let active Redis seat holds expire or explicitly
    reconcile them, apply the final delta, verify again, then switch traffic.

## Cutover Gates

Completed locally:

- [x] Spring clean verification: 179 tests.
- [x] Six-service Docker build and non-root runtime.
- [x] Runtime and event-flow smoke with automatic teardown.
- [x] Fixture migration repeatability, checksum, fingerprint, sequence, and
  Analytics checks.
- [x] Equivalent two-cycle audit against current local development data.
- [x] Spring Keycloak resource-server and signed-identity implementation.

Must complete with the teammate or canonical environment:

- [ ] Teammate branches rebased/merged without overwriting Spring service work.
- [ ] Integrated Keycloak/Gateway security tests with real tokens.
- [ ] ASP.NET Facility contract parity and route replacement.
- [ ] Versioned Payment envelopes and idempotent Booking Saga consumers.
- [ ] Frontend production dependency advisories resolved and booking flow tested.
- [ ] Canonical copied-snapshot migration with aligned PostgreSQL versions.
- [ ] Recommendation graph backfill against the canonical copied snapshot.
- [ ] Active Redis hold/final write-delta plan approved.
- [ ] Shadow traffic and full end-to-end user/admin/staff flows pass.
- [ ] Rollback rehearsal proves return to `backend_legacy` without lost writes.

## Relevant Commits Before This Status Update

- `93daf84` - opt-in Keycloak Resource Server security.
- `54ec974` - signed user identity and ownership binding.
- `9bd9a42` - authentication activation handoff and Compose environment wiring.
- `59e4fac` - native PostgreSQL notice/log handling for migration scripts.
- `b14dd64` - row/content/sequence reconciliation and sequence-drift rehearsal.

The next action is coordinated integration, not more independent Spring service
extraction. A real cutover should begin only after the unchecked gates above are
assigned, evidenced, and approved.
