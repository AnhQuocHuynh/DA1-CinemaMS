param(
    [string]$LegacyDb = "cinema_db",
    [Alias("Host")]
    [string]$DbHost = "localhost",
    [int]$Port = 5432,
    [string]$User = "postgres",
    [string]$OutputDir = "infrastructure/migrations/dumps",
    [string]$PgDump = "pg_dump",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

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

$serviceTables = [ordered]@{
    catalog = @("genres", "movies", "movie_genres", "events")
    facility = @("cinemas", "rooms", "seat_types", "seat_templates")
    showtime = @("showtimes", "showtime_seats")
    booking = @("vouchers", "orders", "tickets", "reviews")
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

foreach ($service in $serviceTables.Keys) {
    $dumpFile = Join-Path $OutputDir "$service.dump"
    $args = @(
        "--host", $DbHost,
        "--port", "$Port",
        "--username", $User,
        "--no-password",
        "--dbname", $LegacyDb,
        "--data-only",
        "--format", "custom",
        "--file", $dumpFile
    )

    foreach ($table in $serviceTables[$service]) {
        $args += @("--table", "public.$table")
    }

    Write-Host "Exporting $service tables to $dumpFile"
    Invoke-CheckedCommand $PgDump $args "pg_dump failed for $service"
}
