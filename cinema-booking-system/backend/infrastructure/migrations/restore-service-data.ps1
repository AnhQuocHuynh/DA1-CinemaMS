param(
    [ValidateSet("all", "catalog", "facility", "showtime", "booking")]
    [string]$Service = "all",
    [string]$Host = "localhost",
    [int]$Port = 5432,
    [string]$User = "postgres",
    [string]$DumpDir = "infrastructure/migrations/dumps",
    [string]$PgRestore = "pg_restore",
    [string]$Psql = "psql",
    [switch]$TruncateFirst
)

$ErrorActionPreference = "Stop"

$targets = [ordered]@{
    catalog = @{
        db = "cinema_catalog_db"
        tables = @("movie_genres", "movies", "genres", "events")
    }
    facility = @{
        db = "cinema_facility_db"
        tables = @("seat_templates", "rooms", "cinemas", "seat_types")
    }
    showtime = @{
        db = "cinema_showtime_db"
        tables = @("showtime_seats", "showtimes")
    }
    booking = @{
        db = "cinema_booking_db"
        tables = @("tickets", "orders", "vouchers", "reviews")
    }
}

$services = if ($Service -eq "all") { $targets.Keys } else { @($Service) }

foreach ($serviceName in $services) {
    $target = $targets[$serviceName]
    $dumpFile = Join-Path $DumpDir "$serviceName.dump"
    if (-not (Test-Path $dumpFile)) {
        throw "Missing dump file: $dumpFile"
    }

    if ($TruncateFirst) {
        $tableList = ($target.tables | ForEach-Object { "public.$_" }) -join ", "
        $truncateSql = "TRUNCATE TABLE $tableList RESTART IDENTITY CASCADE;"
        Write-Host "Truncating $($target.db): $tableList"
        & $Psql --host $Host --port $Port --username $User --dbname $target.db --command $truncateSql
        if ($LASTEXITCODE -ne 0) {
            throw "psql truncate failed for $serviceName"
        }
    }

    Write-Host "Restoring $dumpFile into $($target.db)"
    & $PgRestore --host $Host --port $Port --username $User --dbname $target.db --data-only --disable-triggers $dumpFile
    if ($LASTEXITCODE -ne 0) {
        throw "pg_restore failed for $serviceName"
    }
}
