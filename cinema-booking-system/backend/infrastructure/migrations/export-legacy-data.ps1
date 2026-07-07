param(
    [string]$LegacyDb = "cinema_db",
    [string]$Host = "localhost",
    [int]$Port = 5432,
    [string]$User = "postgres",
    [string]$OutputDir = "infrastructure/migrations/dumps",
    [string]$PgDump = "pg_dump"
)

$ErrorActionPreference = "Stop"

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
        "--host", $Host,
        "--port", "$Port",
        "--username", $User,
        "--dbname", $LegacyDb,
        "--data-only",
        "--format", "custom",
        "--file", $dumpFile
    )

    foreach ($table in $serviceTables[$service]) {
        $args += @("--table", "public.$table")
    }

    Write-Host "Exporting $service tables to $dumpFile"
    & $PgDump @args
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed for $service"
    }
}
