[CmdletBinding()]
param(
    [string]$LegacyDb = "cinema_db",
    [string]$AnalyticsDb = "cinema_analytics_db",
    [Alias("Host")]
    [string]$DbHost = "localhost",
    [int]$LegacyPort = 5432,
    [int]$AnalyticsPort = 5437,
    [string]$User = "postgres",
    [string]$Psql = "psql",
    [string]$WorkDir = "infrastructure/migrations/analytics-dumps",
    [switch]$TruncateFirst,
    [string]$ResetConfirmation = "",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$requiredResetConfirmation = "RESET-COPIED-ANALYTICS-DATABASE"

if ($TruncateFirst -and -not $DryRun -and $ResetConfirmation -ne $requiredResetConfirmation) {
    throw "TruncateFirst requires -ResetConfirmation '$requiredResetConfirmation'. Use it only for a snapshotted or disposable copied analytics database."
}

function Resolve-BackendPath {
    param([string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }

    return Join-Path $BackendDir $Path
}

function ConvertTo-PsqlPath {
    param([string]$Path)

    return $Path.Replace("\", "/")
}

function Invoke-CheckedCommand {
    param(
        [string]$Tool,
        [string[]]$Arguments,
        [string]$FailureMessage
    )

    if ($DryRun) {
        Write-Host "DRY RUN: $Tool $($Arguments -join ' ')"
        return
    }

    & $Tool @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw $FailureMessage
    }
}

function Invoke-Psql {
    param(
        [string]$Database,
        [int]$Port,
        [string]$Command,
        [string]$FailureMessage
    )

    $args = @(
        "--host", $DbHost,
        "--port", "$Port",
        "--username", $User,
        "--no-password",
        "--dbname", $Database,
        "--command", $Command
    )
    Invoke-CheckedCommand $Psql $args $FailureMessage
}

function Invoke-PsqlFile {
    param(
        [string]$Database,
        [int]$Port,
        [string]$File,
        [string]$FailureMessage
    )

    $args = @(
        "--host", $DbHost,
        "--port", "$Port",
        "--username", $User,
        "--no-password",
        "--dbname", $Database,
        "--file", $File
    )
    Invoke-CheckedCommand $Psql $args $FailureMessage
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Resolve-Path (Join-Path $ScriptDir "..\..")
$SchemaFile = Resolve-BackendPath "services/analytics-service/src/main/resources/schema.sql"
$ResolvedWorkDir = Resolve-BackendPath $WorkDir

if (-not (Test-Path $SchemaFile)) {
    throw "Missing analytics schema: $SchemaFile"
}

if (-not $DryRun) {
    New-Item -ItemType Directory -Force -Path $ResolvedWorkDir | Out-Null
}

$datasets = @(
    @{
        Name = "orders"
        File = "analytics_orders.csv"
        Target = "analytics_orders"
        Columns = "order_id, user_id, showtime_id, status, final_amount, seat_ids_snapshot, seat_count, created_at, updated_at"
        Query = @"
SELECT
    id AS order_id,
    user_id,
    showtime_id,
    status,
    COALESCE(final_amount, 0) AS final_amount,
    seat_ids_snapshot,
    CASE
        WHEN seat_ids_snapshot IS NULL OR btrim(seat_ids_snapshot) = '' THEN 0
        ELSE array_length(string_to_array(seat_ids_snapshot, ','), 1)
    END AS seat_count,
    created_at,
    updated_at
FROM public.orders
"@
    },
    @{
        Name = "showtimes"
        File = "analytics_showtimes.csv"
        Target = "analytics_showtimes"
        Columns = "showtime_id, movie_id, event_id, room_id, start_time, status"
        Query = @"
SELECT
    id AS showtime_id,
    movie_id,
    event_id,
    room_id,
    start_time,
    status
FROM public.showtimes
"@
    },
    @{
        Name = "showtime seats"
        File = "analytics_showtime_seats.csv"
        Target = "analytics_showtime_seats"
        Columns = "seat_id, showtime_id, status"
        Query = @"
SELECT
    id AS seat_id,
    showtime_id,
    status
FROM public.showtime_seats
"@
    },
    @{
        Name = "contents"
        File = "analytics_contents.csv"
        Target = "analytics_contents"
        Columns = "content_type, content_id, title, poster_url, active"
        Query = @"
SELECT
    'MOVIE' AS content_type,
    id AS content_id,
    title,
    poster_url,
    active
FROM public.movies
UNION ALL
SELECT
    'EVENT' AS content_type,
    id AS content_id,
    name AS title,
    image_url AS poster_url,
    active
FROM public.events
"@
    },
    @{
        Name = "rooms"
        File = "analytics_rooms.csv"
        Target = "analytics_rooms"
        Columns = "room_id, name"
        Query = @"
SELECT
    id AS room_id,
    name
FROM public.rooms
"@
    },
    @{
        Name = "users"
        File = "analytics_users.csv"
        Target = "analytics_users"
        Columns = "user_id, active"
        Query = @"
SELECT
    id AS user_id,
    active
FROM public.users
"@
    }
)

foreach ($dataset in $datasets) {
    $csvPath = ConvertTo-PsqlPath (Join-Path $ResolvedWorkDir $dataset.File)
    $copyOut = "\copy ($($dataset.Query)) TO '$csvPath' WITH (FORMAT csv, HEADER true)"

    Write-Host "Exporting $($dataset.Name) from $LegacyDb"
    Invoke-Psql $LegacyDb $LegacyPort $copyOut "Failed to export $($dataset.Name)"
}

Write-Host "Ensuring analytics schema in $AnalyticsDb on $DbHost`:${AnalyticsPort}"
Invoke-PsqlFile $AnalyticsDb $AnalyticsPort $SchemaFile "Failed to apply analytics schema"

$importCommands = [System.Collections.Generic.List[string]]::new()
$importCommands.Add("\set ON_ERROR_STOP on")
$importCommands.Add("BEGIN;")

if ($TruncateFirst) {
    $importCommands.Add(@"
TRUNCATE TABLE
    analytics_orders,
    analytics_showtime_seats,
    analytics_showtimes,
    analytics_contents,
    analytics_rooms,
    analytics_users;
"@)
}

foreach ($dataset in $datasets) {
    $csvPath = ConvertTo-PsqlPath (Join-Path $ResolvedWorkDir $dataset.File)
    $escapedCsvPath = $csvPath.Replace("'", "''")
    $importCommands.Add("\copy $($dataset.Target) ($($dataset.Columns)) FROM '$escapedCsvPath' WITH (FORMAT csv, HEADER true)")
}

$importCommands.Add("COMMIT;")
$importFile = Join-Path $ResolvedWorkDir "import-analytics-read-model.sql"

if ($DryRun) {
    Write-Host "DRY RUN: atomic analytics import into $AnalyticsDb using $importFile"
    $importCommands | ForEach-Object { Write-Host $_ }
} else {
    [System.IO.File]::WriteAllLines($importFile, $importCommands, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Importing analytics read model atomically into $AnalyticsDb"
    Invoke-PsqlFile $AnalyticsDb $AnalyticsPort $importFile "Failed to import analytics read model; transaction was rolled back"
}
