param(
    [string]$LegacyDb = "cinema_db",
    [Alias("Host")]
    [string]$DbHost = "localhost",
    [int]$LegacyPort = 5432,
    [int]$Port = 0,
    [int]$CatalogPort = 5433,
    [int]$FacilityPort = 5434,
    [int]$ShowtimePort = 5435,
    [int]$BookingPort = 5436,
    [string]$User = "postgres",
    [string]$Psql = "psql",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Resolve-TargetPort {
    param(
        [hashtable]$Target
    )

    if ($Port -gt 0) {
        return $Port
    }

    return [int]$Target.port
}

function Invoke-PsqlScalar {
    param(
        [string]$Database,
        [int]$DbPort,
        [string]$Sql
    )

    $args = @(
        "--host", $DbHost,
        "--port", "$DbPort",
        "--username", $User,
        "--no-password",
        "--dbname", $Database,
        "--tuples-only",
        "--no-align",
        "--command", $Sql
    )

    if ($DryRun) {
        Write-Host "DRY RUN: $Psql $($args -join ' ')"
        return "0"
    }

    $output = & $Psql @args
    if ($LASTEXITCODE -ne 0) {
        throw "psql failed for $Database on $DbHost`:$DbPort"
    }

    return (($output | Select-Object -Last 1).Trim())
}

function Get-TableCount {
    param(
        [string]$Database,
        [int]$DbPort,
        [string]$TableName
    )

    $sql = "SELECT CASE WHEN to_regclass('public.$TableName') IS NULL THEN -1 ELSE (SELECT COUNT(*) FROM public.$TableName) END;"
    return [int](Invoke-PsqlScalar $Database $DbPort $sql)
}

$targets = [ordered]@{
    catalog = @{
        db = "cinema_catalog_db"
        port = $CatalogPort
        tables = @("genres", "movies", "movie_genres", "events")
    }
    facility = @{
        db = "cinema_facility_db"
        port = $FacilityPort
        tables = @("cinemas", "rooms", "seat_types", "seat_templates")
    }
    showtime = @{
        db = "cinema_showtime_db"
        port = $ShowtimePort
        tables = @("showtimes", "showtime_seats")
    }
    booking = @{
        db = "cinema_booking_db"
        port = $BookingPort
        tables = @("vouchers", "orders", "tickets", "reviews")
    }
}

$mismatches = @()

foreach ($serviceName in $targets.Keys) {
    $target = $targets[$serviceName]
    $targetPort = Resolve-TargetPort $target

    foreach ($table in $target.tables) {
        $legacyCount = Get-TableCount $LegacyDb $LegacyPort $table
        $targetCount = Get-TableCount $target.db $targetPort $table
        $status = if ($legacyCount -eq $targetCount) { "OK" } else { "MISMATCH" }

        [PSCustomObject]@{
            Service = $serviceName
            Table = $table
            LegacyCount = $legacyCount
            TargetCount = $targetCount
            Status = $status
        }

        if ($status -ne "OK") {
            $mismatches += "$serviceName.$table legacy=$legacyCount target=$targetCount"
        }
    }
}

if ($mismatches.Count -gt 0) {
    throw "Row-count verification failed: $($mismatches -join '; ')"
}
