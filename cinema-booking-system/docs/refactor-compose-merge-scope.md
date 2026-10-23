# Merge scope: refactor-compose-single-postgres

Date: 2026-10-23. Branch: `refactor-compose-single-postgres`.

This note records the local merge of origin into the docs commit. It does not change ASP.NET source.

## Commits

- Local `HEAD` before the merge: `6ae221b` (`status update`). That commit edits Markdown only.
- Incoming `MERGE_HEAD`: `5a7e1f7`, which is `origin/refactor-compose-single-postgres` and the head of pull request #17.
- Merge base: `ebdfb9d`.
- The only file both sides changed since the merge base is `backend/README.md`.

Pull request #17 targets `dev` and has no content conflict with `origin/dev` at `0816c46`. Failing checks on that pull request are outside this merge.

## What the git diff is

Files that differ from `6ae221b` and match `5a7e1f7` byte for byte:

| Area | Files vs local `6ae221b` | Owner |
|---|---|---|
| `payment-service` `*.cs` | 47 | ASP.NET. Already on origin. |
| `identity-service` `*.cs` | 5 | ASP.NET. Already on origin. |
| `booking-service` `*.java` | 34 | Spring. Already on origin. |

Do not revert those `.cs` files to make the diff smaller. Restoring the pre-merge copies would drop the payment saga, counter cash, refund, and member-by-phone work already on origin from pull requests #14 and #15 and the staff/payment commits.

## Ownership

Spring work on this branch may change Catalog, Showtime, Booking, Analytics, and Recommendation.

Leave these trees unchanged unless their owner asks:

- `identity-service`
- `facility-service` (ASP.NET on port `5002`, database `facility_db`)
- `payment-service`
- `notification-service`
- `api-gateway`

`facility-service` is not a Spring Boot compatibility slice. `cinema-booking-system/docs/architecture.md` assigns it to ASP.NET Core 9.

## Contracts to read

Do not restate these contracts in new prose. Use the existing files:

- `cinema-booking-system/docs/SPRING_BOOT_HANDOFF_CHANGES.md` for `order.created`, `order.expired`, `POST /api/payments/order/{orderId}/refund`, and counter cash settlement.
- `cinema-booking-system/backend/shared/events/payment-events.md` for the payment envelopes Booking consumes.
- `cinema-booking-system/docs/authentication_integration_contract.md` for Keycloak roles and the transitional `X-Internal-Token` header.

## Next Spring session

Do not edit `*.cs` files and do not revert them. The next safe Spring change starts from Catalog, Showtime, Booking, Analytics, or Recommendation, and keeps the HTTP and event contracts above stable.
