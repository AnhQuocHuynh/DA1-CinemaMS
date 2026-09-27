# Service Data Migration Runbook

Status: dry-runs and a two-pass disposable PostgreSQL rehearsal passed on 2026-08-07, including invariant checks, dump checksums, content fingerprints, sequence-state reconciliation, repeatable Analytics backfill, dump-tamper rejection, and sequence-drift rejection. The same two-pass restore and verification also passed against the current local development database on disposable PostgreSQL 18 targets. Execution against the canonical copied cutover snapshot still requires its credential and PostgreSQL version alignment. `backend_legacy` remains the rollback source of truth until traffic is switched and validated.

## Owned Tables

| Service | Target database | Tables |
|---|---|---|
| catalog-service | `cinema_catalog_db` | `genres`, `movies`, `movie_genres`, `events` |
| facility-service | `cinema_facility_db` | `cinemas`, `rooms`, `seat_types`, `seat_templates` |
| showtime-service | `cinema_showtime_db` | `showtimes`, `showtime_seats` |
| booking-service | `cinema_booking_db` | `vouchers`, `orders`, `tickets`, `reviews` |
| analytics-service | `cinema_analytics_db` | Derived read model: `analytics_orders`, `analytics_showtimes`, `analytics_showtime_seats`, `analytics_contents`, `analytics_rooms`, `analytics_users` |
| recommendation-service | Neo4j `neo4j` database | Derived graph: movies, genres, watched orders, and movie ratings |

## Preconditions

1. Legacy backend is stopped or in maintenance mode for final cutover export.
2. Service databases are created and reachable.
3. Service applications have run at least once or migrations have created schemas.
4. No frontend or gateway traffic points at extracted services during backfill.
5. `PGPASSWORD` is set in the shell, or `.pgpass` is configured.
6. `pg_dump`, `pg_restore`, and `psql` are available in PATH, or their full paths are passed to the scripts.
7. PostgreSQL client and server major versions are aligned. Use client tools matching the copied source and a target server on the same or newer major; restore rejects a newer `pg_restore` client before mutating an older target.

The scripts pass `--no-password` so unattended migration fails immediately instead of hanging on a password prompt. Set `PGPASSWORD` only for the migration process or configure a protected `.pgpass` file; do not commit credentials.

If PostgreSQL client tools are installed but not in PATH on Windows, pass them explicitly. Set the example major to the major shared by the copied source and migration targets:

```powershell
$pgMajor = "18" # Replace with the major shared by the source and targets.
$pgBin = "C:\Program Files\PostgreSQL\$pgMajor\bin"
.\infrastructure\migrations\export-legacy-data.ps1 -PgDump "$pgBin\pg_dump.exe" -Psql "$pgBin\psql.exe" -DryRun
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

Before exporting, the script rejects orphaned or invalid cross-domain rows. It then writes one custom-format dump per service and an atomic `migration-manifest.json` containing source metadata, table ownership, file size, and SHA-256 checksum into `infrastructure/migrations/dumps/`.

Use `-DryRun` first when validating the generated `pg_dump` commands.

## Disposable Rehearsal

Before using a real snapshot, run the complete procedure against the isolated
fixture:

```powershell
.\infrastructure\migrations\migration-rehearsal.ps1
```

The rehearsal starts its own PostgreSQL container on port `55432` with tmpfs
storage, initializes source and target schemas, exports and restores twice,
compares all 14 table fingerprints and owned sequence states, backfills
Analytics twice, verifies stable derived counts, and proves that both a
tampered dump and a deliberately stale target sequence are rejected. The
guarded restore then repairs the test sequence drift. The rehearsal always
removes its container, network, and temporary files unless `-KeepArtifacts` is
supplied.

## Restore

Restore into empty service databases first. Use `-TruncateFirst` only when the target DB is disposable or already snapshotted.
By default, the restore script targets the current extracted Compose layout:
one PostgreSQL 18 server on host port `5432` with logical databases
`cinema_catalog_db`, `cinema_facility_db`, `cinema_showtime_db`, and
`cinema_booking_db`. Pass per-service `-CatalogPort` / `-FacilityPort` /
`-ShowtimePort` / `-BookingPort` only when an older multi-container layout is
still running.

```powershell
.\infrastructure\migrations\restore-service-data.ps1 `
  -Service all `
  -TruncateFirst `
  -ResetConfirmation RESET-COPIED-SERVICE-DATABASES
```

Use `-DryRun` before the actual restore. `-Port 5432` still forces every
service onto one host port if a script invocation mixed old per-service
defaults.

## Analytics Read Model

Analytics uses a derived read model instead of a table-for-table restore. After the normal service restore, create/populate `cinema_analytics_db` from a copied legacy database:

```powershell
.\infrastructure\migrations\backfill-analytics-read-model.ps1 `
  -TruncateFirst `
  -ResetConfirmation RESET-COPIED-ANALYTICS-DATABASE
```

Run with `-DryRun` first. The script applies `services/analytics-service/src/main/resources/schema.sql`, exports the legacy dashboard source tables to CSV, then imports the derived rows into the analytics read-model tables.

All Analytics source datasets are exported before the target schema is touched. Target truncation and all CSV imports run in one database transaction, so an import failure rolls the read model back instead of leaving it partially populated.

## Destructive Guards

- `-TruncateFirst` is rejected unless the matching `-ResetConfirmation` phrase is supplied.
- Restore requires the export manifest and validates each dump SHA-256 before any target mutation.
- Restore verifies that `pg_restore` is not newer than the target PostgreSQL server.
- Each service dump is validated with `pg_restore --list` before target truncation.
- Service restores use `--exit-on-error` and `--single-transaction`.
- These guards do not make a production database an acceptable target. Only use copied, disposable, or independently snapshotted service databases.

## Recommendation Graph

Recommendation backfill reads a copied legacy PostgreSQL database through a
read-only JDBC connection and projects deterministic synthetic events through
the same idempotent Neo4j path used by RabbitMQ consumers. It does not truncate
the graph. Repeating the same source snapshot is safe and reports duplicate
events instead of duplicating relationships.

Keep `RECOMMENDATION_MESSAGING_ENABLED=false` while running the initial
backfill. Start Neo4j, then run the Recommendation service first in dry-run
mode:

```powershell
$env:RECOMMENDATION_GRAPH_ENABLED = "true"
$env:SPRING_NEO4J_URI = "bolt://localhost:7687"
$env:SPRING_NEO4J_AUTHENTICATION_USERNAME = "neo4j"
$env:SPRING_NEO4J_AUTHENTICATION_PASSWORD = "<neo4j-password>"
$env:RECOMMENDATION_BACKFILL_ENABLED = "true"
$env:RECOMMENDATION_BACKFILL_DRY_RUN = "true"
$env:RECOMMENDATION_BACKFILL_SOURCE_URL = "jdbc:postgresql://localhost:5432/cinema_db_copy"
$env:RECOMMENDATION_BACKFILL_SOURCE_USERNAME = "postgres"
$env:RECOMMENDATION_BACKFILL_SOURCE_PASSWORD = "<copied-db-password>"
mvn -pl services/recommendation-service spring-boot:run
```

After reviewing source counts, set:

```powershell
$env:RECOMMENDATION_BACKFILL_DRY_RUN = "false"
$env:RECOMMENDATION_BACKFILL_CONFIRMATION = "BACKFILL-COPIED-LEGACY-TO-RECOMMENDATION"
```

Run the service again and stop it after the backfill and minimum graph-count
verification complete. Do not point this process at the writable production
legacy database. The source connection is forced read-only, but a copied or
snapshotted database remains a required operational boundary.

## Verification

Compare legacy and service row counts, order-independent content fingerprints,
and owned ID-sequence state before any route switch:

```powershell
.\infrastructure\migrations\verify-service-counts.ps1
```

The verification fails when source and target sequence state differs or when
the next sequence value would collide with an existing ID. This protects the
first post-cutover write, which row counts alone cannot verify.

The lower-level `verify-counts.sql` can still be run manually against the legacy DB and each target DB when inspecting one database at a time.

After count checks, run the baseline runtime smoke script from `cinema-booking-system/backend`:

```powershell
.\infrastructure\smoke-test.ps1
```

Then verify the complete event path and consumer idempotency/ordering:

```powershell
.\infrastructure\event-flow-smoke.ps1
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
