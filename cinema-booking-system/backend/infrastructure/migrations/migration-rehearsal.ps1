[CmdletBinding()]
param(
    [string]$PgDump = "",
    [string]$PgRestore = "",
    [string]$Psql = "",
    [int]$Port = 55432,
    [string]$Password = "rehearsal-only",
    [switch]$KeepArtifacts
)

$ErrorActionPreference = "Stop"

function Resolve-PostgresTool {
    param(
        [string]$ConfiguredPath,
        [string]$ToolName
    )

    if (-not [string]::IsNullOrWhiteSpace($ConfiguredPath)) {
        if (-not (Test-Path -LiteralPath $ConfiguredPath)) {
            throw "PostgreSQL tool not found: $ConfiguredPath"
        }
        return (Resolve-Path -LiteralPath $ConfiguredPath).Path
    }

    $command = Get-Command $ToolName -ErrorAction SilentlyContinue
    if ($null -ne $command) {
        return $command.Source
    }

    $windowsCandidates = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$ToolName.exe" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending
    if ($windowsCandidates.Count -gt 0) {
        return $windowsCandidates[0].FullName
    }

    throw "PostgreSQL tool '$ToolName' is not available. Pass its full path explicitly."
}

function Invoke-CheckedTool {
    param(
        [string]$Tool,
        [string[]]$Arguments,
        [string]$FailureMessage
    )

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & $Tool @Arguments 2>&1 | ForEach-Object { Write-Host ($_.ToString()) }
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($exitCode -ne 0) {
        throw $FailureMessage
    }
}

function Invoke-Compose {
    param([string[]]$Arguments)

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & docker compose -f $ComposeFile @Arguments 2>&1 | ForEach-Object { Write-Host ($_.ToString()) }
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($exitCode -ne 0) {
        throw "Migration rehearsal compose failed: $($Arguments -join ' ')"
    }
}

function Initialize-TargetSchemas {
    $serviceTables = [ordered]@{
        cinema_catalog_db = @("genres", "movies", "movie_genres", "events")
        cinema_facility_db = @("cinemas", "rooms", "seat_types", "seat_templates")
        cinema_showtime_db = @("showtimes", "showtime_seats")
        cinema_booking_db = @("vouchers", "orders", "tickets", "reviews")
    }

    foreach ($database in $serviceTables.Keys) {
        $schemaFile = Join-Path $ArtifactDir "$database-schema.sql"
        $dumpArguments = @(
            "--host", "localhost",
            "--port", "$Port",
            "--username", "postgres",
            "--no-password",
            "--dbname", "cinema_legacy_fixture",
            "--schema-only",
            "--no-owner",
            "--no-privileges",
            "--file", $schemaFile
        )
        foreach ($table in $serviceTables[$database]) {
            $dumpArguments += @("--table", "public.$table")
        }
        Invoke-CheckedTool $ResolvedPgDump $dumpArguments "Could not export rehearsal schema for $database"

        $psqlArguments = @(
            "--host", "localhost",
            "--port", "$Port",
            "--username", "postgres",
            "--no-password",
            "--dbname", $database,
            "--set", "ON_ERROR_STOP=1",
            "--file", $schemaFile
        )
        Invoke-CheckedTool $ResolvedPsql $psqlArguments "Could not initialize rehearsal schema for $database"
    }
    Write-Host "[OK] Initialized disposable target schemas"
}

function Invoke-DataMigration {
    & $ExportScript `
        -LegacyDb cinema_legacy_fixture `
        -DbHost localhost `
        -Port $Port `
        -User postgres `
        -OutputDir $DumpDir `
        -PgDump $ResolvedPgDump `
        -Psql $ResolvedPsql

    $manifest = Get-Content -LiteralPath (Join-Path $DumpDir "migration-manifest.json") -Raw | ConvertFrom-Json
    if ($manifest.formatVersion -ne 1 -or @($manifest.services).Count -ne 4) {
        throw "Rehearsal export produced an invalid migration manifest"
    }
    Write-Host "[OK] Exported fixture with four SHA-256 manifest entries"

    foreach ($attempt in 1..2) {
        & $RestoreScript `
            -Service all `
            -DbHost localhost `
            -Port $Port `
            -User postgres `
            -DumpDir $DumpDir `
            -PgRestore $ResolvedPgRestore `
            -Psql $ResolvedPsql `
            -TruncateFirst `
            -ResetConfirmation "RESET-COPIED-SERVICE-DATABASES"

        & $VerifyScript `
            -LegacyDb cinema_legacy_fixture `
            -DbHost localhost `
            -LegacyPort $Port `
            -Port $Port `
            -User postgres `
            -Psql $ResolvedPsql

        Write-Host "[OK] Restore/fingerprint pass $attempt succeeded"
    }
}

function Invoke-AnalyticsRehearsal {
    foreach ($attempt in 1..2) {
        & $AnalyticsScript `
            -LegacyDb cinema_legacy_fixture `
            -AnalyticsDb cinema_analytics_db `
            -DbHost localhost `
            -LegacyPort $Port `
            -AnalyticsPort $Port `
            -User postgres `
            -Psql $ResolvedPsql `
            -WorkDir (Join-Path $ArtifactDir "analytics") `
            -TruncateFirst `
            -ResetConfirmation "RESET-COPIED-ANALYTICS-DATABASE"
    }

    $verificationSql = @"
SELECT (SELECT COUNT(*) FROM analytics_orders)
       || '|' || (SELECT COUNT(*) FROM analytics_showtimes)
       || '|' || (SELECT COUNT(*) FROM analytics_showtime_seats)
       || '|' || (SELECT COUNT(*) FROM analytics_contents)
       || '|' || (SELECT COUNT(*) FROM analytics_rooms)
       || '|' || (SELECT COUNT(*) FROM analytics_users);
"@
    $arguments = @(
        "--host", "localhost",
        "--port", "$Port",
        "--username", "postgres",
        "--no-password",
        "--dbname", "cinema_analytics_db",
        "--tuples-only",
        "--no-align",
        "--command", $verificationSql
    )
    $output = & $ResolvedPsql @arguments
    if ($LASTEXITCODE -ne 0 -or (($output | Select-Object -Last 1).Trim()) -ne "1|2|2|2|1|1") {
        throw "Analytics rehearsal counts are not deterministic after repeated backfill"
    }
    Write-Host "[OK] Analytics backfill is repeatable and count-verified"
}

function Test-ChecksumGuard {
    $tamperedDir = Join-Path $ArtifactDir "tampered"
    New-Item -ItemType Directory -Path $tamperedDir -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $DumpDir "migration-manifest.json") -Destination $tamperedDir
    $tamperedDump = Join-Path $tamperedDir "catalog.dump"
    Copy-Item -LiteralPath (Join-Path $DumpDir "catalog.dump") -Destination $tamperedDump

    $stream = [IO.File]::Open($tamperedDump, [IO.FileMode]::Append, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try {
        $stream.WriteByte(0)
    } finally {
        $stream.Dispose()
    }

    $checksumRejected = $false
    try {
        & $RestoreScript `
            -Service catalog `
            -DbHost localhost `
            -Port $Port `
            -User postgres `
            -DumpDir $tamperedDir `
            -PgRestore $ResolvedPgRestore `
            -Psql $ResolvedPsql
    } catch {
        if ($_.Exception.Message -like "*SHA-256 mismatch*") {
            $checksumRejected = $true
        } else {
            throw
        }
    }

    if (-not $checksumRejected) {
        throw "Tampered dump was not rejected by the SHA-256 guard"
    }
    Write-Host "[OK] Tampered dump was rejected before restore"
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Resolve-Path (Join-Path $ScriptDir "..\..")
$ComposeFile = Join-Path $BackendDir "infrastructure\docker-compose.migration-rehearsal.yml"
$ExportScript = Join-Path $ScriptDir "export-legacy-data.ps1"
$RestoreScript = Join-Path $ScriptDir "restore-service-data.ps1"
$VerifyScript = Join-Path $ScriptDir "verify-service-counts.ps1"
$AnalyticsScript = Join-Path $ScriptDir "backfill-analytics-read-model.ps1"
$ResolvedPgDump = Resolve-PostgresTool $PgDump "pg_dump"
$ResolvedPgRestore = Resolve-PostgresTool $PgRestore "pg_restore"
$ResolvedPsql = Resolve-PostgresTool $Psql "psql"
$ArtifactDir = Join-Path ([IO.Path]::GetTempPath()) "cinema-migration-rehearsal-$([Guid]::NewGuid())"
$DumpDir = Join-Path $ArtifactDir "dumps"
$previousPassword = $env:PGPASSWORD

New-Item -ItemType Directory -Path $DumpDir -Force | Out-Null
$env:PGPASSWORD = $Password

try {
    Invoke-Compose -Arguments @("up", "--detach", "--wait")
    Initialize-TargetSchemas
    Invoke-DataMigration
    Invoke-AnalyticsRehearsal
    Test-ChecksumGuard
    Write-Host "[OK] Disposable migration rehearsal passed."
} finally {
    try {
        Invoke-Compose -Arguments @("down", "--volumes")
    } catch {
        Write-Warning "Could not tear down migration rehearsal: $($_.Exception.Message)"
    }

    if ($null -eq $previousPassword) {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    } else {
        $env:PGPASSWORD = $previousPassword
    }

    if ($KeepArtifacts) {
        Write-Host "Migration rehearsal artifacts retained at $ArtifactDir"
    } else {
        Remove-Item -LiteralPath $ArtifactDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
