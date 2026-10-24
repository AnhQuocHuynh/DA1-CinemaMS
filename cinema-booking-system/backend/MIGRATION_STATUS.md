# Backend Migration Status

Updated: 2026-10-11

## Executive Decision

Spring Catalog, Showtime, Booking, Analytics, and Recommendation were
migration-prepared by 2026-08-07. Since then, Keycloak, the YARP gateway,
ASP.NET Facility, Identity, Payment, and Notification have landed on
`refactor-compose-single-postgres` (HEAD `ebdfb9d` when this note was written).

That merge is source presence, not a new cutover proof. On 2026-10-11 the
current Spring reactor passed `mvn clean verify` (180 tests) and the frontend
production build passed. Compose was started locally. The scripted smoke stops
because facility health is `/health`, not `/actuator/health`. ASP.NET facility,
identity, and payment tests have failures. The payment saga, notification
email, and booking UI were not run. Counts are in
`../../docs/CURRENT_STATE.md`.

This does **not** mean the product is ready for traffic cutover. The remaining
work is a live integrated run (gateway auth, payment events, notification
email, staff routes), then a rehearsal against the canonical copied database
snapshot and an approved traffic/rollback procedure.

Until those gates pass:

- `backend_legacy` remains the complete runnable backend and rollback source.
- `CINEMA_SECURITY_JWT_ENABLED` remains `false` in the standalone Spring stack.
- Public traffic must not be routed directly to extracted service ports.
- No canonical database or production write traffic has been migrated.

## Ownership Boundary

| Area | Owner | Current position |
|---|---|---|
| Catalog | Spring | In this branch. Last clean-verify evidence is 2026-08-07 |
| Showtime | Spring | In this branch |
| Booking | Spring | Payment consumers implemented. No staff aggregate API |
| Analytics | Spring | In this branch |
| Recommendation | Spring | In this branch and used by the home page |
| Facility | ASP.NET | Cinema, room, and seat APIs are in this branch. Health is `/health`. Database is `facility_db` |
| Identity/Keycloak | ASP.NET + Keycloak | In Compose. Frontend uses Keycloak PKCE. User delete is not implemented |
| API Gateway | ASP.NET | In Compose on port 5000. No notification or `/api/staff/**` routes |
| Payment | ASP.NET | Stripe, PayPal, cash, and `RefundAsync` are in this branch. MassTransit entity name is `payment.events`. Live saga not re-run on 2026-10-11 |
| Notification | ASP.NET | Email consumers and SignalR hub are in this branch. SMS logs only. Gateway does not route it |

## Spring Deliverables Complete

Recorded before Facility became the ASP.NET service. The Spring list is now
Catalog, Showtime, Booking, Analytics, and Recommendation.

- Those Spring applications build independently.
- Catalog, Showtime, and Booking talk to Facility over HTTP rather than sharing
  repositories or entities.
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

Keycloak and the gateway are in this branch. Spring JWT stays off until one
integrated environment shows all of the following:

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

The 2026-08-07 audit used disposable PostgreSQL 18 targets because the local
`my-postgres` source was 18 and Compose still targeted 16. Extracted Compose
on `refactor-compose-single-postgres` now runs PostgreSQL 18 on host port
`5432` with logical service databases. Before the canonical rehearsal, confirm
the copied snapshot is also PostgreSQL 18 and keep client tools on that major.
Do not bypass the version guard. Do not restore an older multi-Postgres port
map (`5433`-`5437`) onto this branch.

Local dump files and credentials were not retained. For the canonical rehearsal,
archive the manifest, checksums, reconciliation output, and approved rollback
point in the team's protected evidence location.

## Service Matrix

| Service | Status | Remaining external dependency |
|---|---|---|
| `catalog-service` | Ready for coordinated migration | Gateway/Keycloak activation and canonical data snapshot |
| `showtime-service` | Ready for coordinated migration | Gateway/Keycloak activation, Redis hold cutover plan, and canonical snapshot |
| `booking-service` | Consumers implemented; not cut over | Live payment-event run, staff routes, canonical snapshot |
| `analytics-service` | Ready for coordinated migration | Identity data/event integration and canonical backfill |
| `recommendation-service` | Ready for coordinated migration | Canonical graph backfill and integrated user identity |
| `facility-service` | ASP.NET implementation in Compose | Contract parity against Showtime/Booking clients not re-run |
| `identity-service` | In Compose | User delete and real-token suite still open |
| `api-gateway` | In Compose | Notification and `/api/staff/**` routes missing. Real-token suite not re-run |
| `payment-service` | In Compose; publishes to `payment.events` in source | Live saga against Booking not re-run on 2026-10-11 |
| `notification-service` | Email consumers in Compose | Gateway route missing. SMS is log-only |

## Cross-Workstream Contracts Still Pending

### Auth and Gateway

Keycloak and the gateway are already in this branch's Compose file. Do not
merge an older branch that replaces the single PostgreSQL 18 container with
one database container per service.

Run every security test in Section 14 of the authentication contract. Only
after those tests pass should `CINEMA_SECURITY_JWT_ENABLED=true` be enabled.

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

Payment's MassTransit configuration now sets the entity name `payment.events`
for `payment.completed`, `payment.failed`, and `payment.refunded`. That was
read from source on 2026-10-11 and was not executed against RabbitMQ.

Booking consumes those three outcomes when `BOOKING_PAYMENT_EVENTS_ENABLED=true`
(idempotent on `eventId`, stale transitions ignored, checked-in refunds
dead-lettered). The open check is a live complete/fail/refund/duplicate/poison
run. Notes: `../docs/booking_status.md`.

Do not copy this integration into `backend_legacy`. That tree is rollback only.

### Facility

Compose builds the ASP.NET Facility service. There is no Spring Facility source
to extend. Integration must keep the public and internal behavior Showtime and
Booking already call, especially room and cinema projections and
future-showtime delete guards. That parity suite was not re-run on 2026-10-11.

## Safe Integration and Cutover Order

1. Keep the single PostgreSQL 18 Compose file. Do not overlay an older
   per-service Postgres layout.
2. Freeze issuer, audience, roles, claims, header stripping, and `/internal/**`
   blocking on the gateway that is already in this branch.
3. Pass the real-token security suite, then enable Spring JWT in that environment.
4. Run Facility contract tests against the ASP.NET service and the Showtime and
   Booking clients.
5. Run the Booking consumer matrix against Payment's `payment.events` publish
   path (complete / fail / refund / duplicate / poison).
6. Rerun clean build, runtime smoke, event flow, auth, payment saga, and one
   frontend booking on this merged stack. Add the missing notification and
   staff gateway routes before calling staff and inbox flows done.
7. Confirm the canonical PostgreSQL version; take a protected read-only copy and
   run the guarded export/restore/backfill twice on disposable targets.
8. Archive checksums, content/sequence reconciliation, graph/read-model counts,
   and test logs. Any mismatch stops the migration.
9. Rehearse rollback and shadow/read traffic while `backend_legacy` remains
   available.
10. Schedule a write freeze, let active Redis seat holds expire or explicitly
    reconcile them, apply the final delta, verify again, then switch traffic.

## Cutover Gates

Completed locally on 2026-08-07 unless noted. The 2026-10-11 run is a separate, narrower check (see the executive note). These August gates were not repeated:

- [x] Spring clean verification: 179 tests.
- [x] Six Spring Docker images and non-root runtime.
- [x] Runtime and event-flow smoke with automatic teardown.
- [x] Fixture migration repeatability, checksum, fingerprint, sequence, and
  Analytics checks.
- [x] Equivalent two-cycle audit against current local development data.
- [x] Spring Keycloak resource-server and signed-identity implementation.
- [x] Idempotent Booking Saga consumers in `booking-service` (unit-tested 2026-08-23).

Present in source on 2026-10-11, not re-executed:

- [x] Gateway, Keycloak, ASP.NET Facility, Identity, Payment, and Notification are in this branch's Compose file.
- [x] Payment entity name is `payment.events` for the three outcome events.
- [x] Notification consumes booking and identity events and can send email.

Still open:

- [ ] Integrated Keycloak/Gateway security tests with real tokens.
- [ ] ASP.NET Facility contract parity with Showtime and Booking clients.
- [ ] Live Payment-to-Booking consumer matrix on the merged stack.
- [ ] Gateway routes for notification HTTP/SignalR and for staff dashboard and counter booking.
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

The next action is a live run of the stack that is already merged, not another
service extraction. A cutover starts only after the open gates have fresh evidence.
