# Service Data Migration Runbook

Status: draft, not yet executed. `backend_legacy` remains the rollback source of truth until gateway traffic is switched and validated.

## Owned Tables

| Service | Target database | Tables |
|---|---|---|
| catalog-service | `cinema_catalog_db` | `genres`, `movies`, `movie_genres`, `events` |
| facility-service | `cinema_facility_db` | `cinemas`, `rooms`, `seat_types`, `seat_templates` |
| showtime-service | `cinema_showtime_db` | `showtimes`, `showtime_seats` |
| booking-service | `cinema_booking_db` | `vouchers`, `orders`, `tickets`, `reviews` |
| analytics-service | `cinema_analytics_db` | Derived read model: `analytics_orders`, `analytics_showtimes`, `analytics_showtime_seats`, `analytics_contents`, `analytics_rooms`, `analytics_users` |

## Preconditions

1. Legacy backend is stopped or in maintenance mode for final cutover export.
2. Service databases are created and reachable.
3. Service applications have run at least once or migrations have created schemas.
4. No frontend or gateway traffic points at extracted services during backfill.
5. `PGPASSWORD` is set in the shell, or `.pgpass` is configured.
6. `pg_dump`, `pg_restore`, and `psql` are available in PATH, or their full paths are passed to the scripts.

If PostgreSQL client tools are installed but not in PATH on Windows, pass them explicitly:

```powershell
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
.\infrastructure\migrations\export-legacy-data.ps1 -PgDump "$pgBin\pg_dump.exe" -DryRun
.\infrastructure\migrations\restore-service-data.ps1 -PgRestore "$pgBin\pg_restore.exe" -Psql "$pgBin\psql.exe" -DryRun
.\infrastructure\migrations\verify-service-counts.ps1 -Psql "$pgBin\psql.exe" -DryRun
.\infrastructure\migrations\backfill-analytics-read-model.ps1 -Psql "$pgBin\psql.exe" -DryRun
```

## Export

From `cinema-booking-system/backend`:

```powershell
.\infrastructure\migrations\export-legacy-data.ps1 `
  -LegacyDb cinema_db `
  -Host localhost `
  -Port 5432 `
  -User postgres
```

This writes one custom-format dump per service into `infrastructure/migrations/dumps/`.

Use `-DryRun` first when validating the generated `pg_dump` commands.

## Restore

Restore into empty service databases first. Use `-TruncateFirst` only when the target DB is disposable or already snapshotted.
By default, the restore script targets the Docker Compose database ports:

- Catalog: `5433`
- Facility compatibility DB: `5434`
- Showtime: `5435`
- Booking: `5436`

```powershell
.\infrastructure\migrations\restore-service-data.ps1 -Service all -TruncateFirst
```

Use `-DryRun` before the actual restore, or pass `-Port 5432` only when all service databases live on one PostgreSQL server.

## Analytics Read Model

Analytics uses a derived read model instead of a table-for-table restore. After the normal service restore, create/populate `cinema_analytics_db` from a copied legacy database:

```powershell
.\infrastructure\migrations\backfill-analytics-read-model.ps1 -TruncateFirst
```

Run with `-DryRun` first. The script applies `services/analytics-service/src/main/resources/schema.sql`, exports the legacy dashboard source tables to CSV, then imports the derived rows into the analytics read-model tables.

## Verification

Compare legacy and service row counts before any route switch:

```powershell
.\infrastructure\migrations\verify-service-counts.ps1
```

The lower-level `verify-counts.sql` can still be run manually against the legacy DB and each target DB when inspecting one database at a time.

After count checks, run the baseline runtime smoke script from `cinema-booking-system/backend`:

```powershell
.\infrastructure\smoke-test.ps1
```

Then run seeded service-level flow checks:

- Catalog browse/search.
- Facility room and seat template reads.
- Showtime seat map and hold flow.
- Booking create order, pay, ticket lookup, refund.

## Rollback

Before route switch:

1. Stop extracted service traffic.
2. Drop or truncate target service DB data if the backfill is bad.
3. Keep using `backend_legacy`; no legacy data was mutated by export/restore.

After route switch:

1. Stop gateway routes to extracted services.
2. Route `/api/**` back to `backend_legacy`.
3. Preserve target service DBs for audit; do not overwrite until incident notes are captured.
4. Reconcile any writes accepted by extracted services before retrying cutover.

Do not run destructive target cleanup without confirming traffic has returned to legacy.
