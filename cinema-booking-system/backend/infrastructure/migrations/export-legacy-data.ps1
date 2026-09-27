param(
    [string]$LegacyDb = "cinema_db",
    [Alias("Host")]
    [string]$DbHost = "localhost",
    [int]$Port = 5432,
    [string]$User = "postgres",
    [string]$OutputDir = "infrastructure/migrations/dumps",
    [string]$PgDump = "pg_dump",
    [string]$Psql = "psql",
    [switch]$SkipInvariantCheck,
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

$serviceTables = [ordered]@{
    catalog = @("genres", "movies", "movie_genres", "events")
    facility = @("cinemas", "rooms", "seat_types", "seat_templates")
    showtime = @("showtimes", "showtime_seats")
    booking = @("vouchers", "orders", "tickets", "reviews")
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InvariantFile = Join-Path $ScriptDir "verify-legacy-invariants.sql"
if (-not (Test-Path $InvariantFile)) {
    throw "Missing legacy invariant check: $InvariantFile"
}

if (-not $SkipInvariantCheck) {
    $invariantArgs = @(
        "--host", $DbHost,
        "--port", "$Port",
        "--username", $User,
        "--no-password",
        "--dbname", $LegacyDb,
        "--set", "ON_ERROR_STOP=1",
        "--file", $InvariantFile
    )
    Write-Host "Checking legacy relational invariants before export"
    Invoke-CheckedCommand $Psql $invariantArgs "Legacy invariant verification failed; export aborted"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$manifestEntries = @()

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

    if (-not $DryRun) {
        $dumpInfo = Get-Item -LiteralPath $dumpFile
        $manifestEntries += [ordered]@{
            service = $service
            file = $dumpInfo.Name
            tables = @($serviceTables[$service])
            bytes = $dumpInfo.Length
            sha256 = (Get-FileHash -LiteralPath $dumpFile -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }
}

$manifestFile = Join-Path $OutputDir "migration-manifest.json"
if ($DryRun) {
    Write-Host "DRY RUN: write SHA-256 migration manifest to $manifestFile"
} else {
    $manifest = [ordered]@{
        formatVersion = 1
        migrationId = [Guid]::NewGuid().ToString()
        createdAtUtc = [DateTimeOffset]::UtcNow.ToString("o")
        source = [ordered]@{
            host = $DbHost
            port = $Port
            database = $LegacyDb
            user = $User
        }
        services = $manifestEntries
    }
    $temporaryManifest = "$manifestFile.tmp"
    [IO.File]::WriteAllText(
        $temporaryManifest,
        ($manifest | ConvertTo-Json -Depth 8),
        [Text.UTF8Encoding]::new($false)
    )
    Move-Item -LiteralPath $temporaryManifest -Destination $manifestFile -Force
    Write-Host "Wrote immutable dump manifest: $manifestFile"
}
