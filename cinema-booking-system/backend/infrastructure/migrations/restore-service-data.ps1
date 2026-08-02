param(
    [ValidateSet("all", "catalog", "facility", "showtime", "booking")]
    [string]$Service = "all",
    [Alias("Host")]
    [string]$DbHost = "localhost",
    [int]$Port = 0,
    [int]$CatalogPort = 5433,
    [int]$FacilityPort = 5434,
    [int]$ShowtimePort = 5435,
    [int]$BookingPort = 5436,
    [string]$User = "postgres",
    [string]$DumpDir = "infrastructure/migrations/dumps",
    [string]$PgRestore = "pg_restore",
    [string]$Psql = "psql",
    [switch]$TruncateFirst,
    [string]$ResetConfirmation = "",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$requiredResetConfirmation = "RESET-COPIED-SERVICE-DATABASES"

if ($TruncateFirst -and -not $DryRun -and $ResetConfirmation -ne $requiredResetConfirmation) {
    throw "TruncateFirst requires -ResetConfirmation '$requiredResetConfirmation'. Use it only for snapshotted or disposable copied databases."
}

function Resolve-TargetPort {
    param(
        [hashtable]$Target
    )

    if ($Port -gt 0) {
        return $Port
    }

    return [int]$Target.port
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

function Test-DumpFile {
    param([string]$DumpFile)

    if ($DryRun) {
        Write-Host "DRY RUN: $PgRestore --list $DumpFile"
        return
    }

    & $PgRestore --list $DumpFile | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Invalid or unreadable dump file: $DumpFile"
    }
}

$targets = [ordered]@{
    catalog = @{
        db = "cinema_catalog_db"
        port = $CatalogPort
        tables = @("movie_genres", "movies", "genres", "events")
    }
    facility = @{
        db = "cinema_facility_db"
        port = $FacilityPort
        tables = @("seat_templates", "rooms", "cinemas", "seat_types")
    }
    showtime = @{
        db = "cinema_showtime_db"
        port = $ShowtimePort
        tables = @("showtime_seats", "showtimes")
    }
    booking = @{
        db = "cinema_booking_db"
        port = $BookingPort
        tables = @("tickets", "orders", "vouchers", "reviews")
    }
}

$services = if ($Service -eq "all") { $targets.Keys } else { @($Service) }

foreach ($serviceName in $services) {
    $target = $targets[$serviceName]
    $targetPort = Resolve-TargetPort $target
    $dumpFile = Join-Path $DumpDir "$serviceName.dump"
    if (-not (Test-Path $dumpFile) -and -not $DryRun) {
        throw "Missing dump file: $dumpFile"
    }
    if (-not (Test-Path $dumpFile) -and $DryRun) {
        Write-Host "DRY RUN: dump file does not exist yet: $dumpFile"
    }
    Test-DumpFile $dumpFile

    if ($TruncateFirst) {
        $tableList = ($target.tables | ForEach-Object { "public.$_" }) -join ", "
        $truncateSql = "TRUNCATE TABLE $tableList RESTART IDENTITY CASCADE;"
        Write-Host "Truncating $($target.db) on $DbHost`:${targetPort}: $tableList"
        $truncateArgs = @("--host", $DbHost, "--port", "$targetPort", "--username", $User, "--no-password", "--dbname", $target.db, "--command", $truncateSql)
        Invoke-CheckedCommand $Psql $truncateArgs "psql truncate failed for $serviceName"
    }

    Write-Host "Restoring $dumpFile into $($target.db) on $DbHost`:${targetPort}"
    $restoreArgs = @(
        "--host", $DbHost,
        "--port", "$targetPort",
        "--username", $User,
        "--no-password",
        "--dbname", $target.db,
        "--data-only",
        "--disable-triggers",
        "--no-owner",
        "--no-privileges",
        "--exit-on-error",
        "--single-transaction",
        $dumpFile
    )
    Invoke-CheckedCommand $PgRestore $restoreArgs "pg_restore failed for $serviceName"
}
