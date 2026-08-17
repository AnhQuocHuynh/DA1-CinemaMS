param(
    [ValidateSet("all", "catalog", "facility", "showtime", "booking")]
    [string]$Service = "all",
    [Alias("Host")]
    [string]$DbHost = "localhost",
    [int]$Port = 0,
    [int]$CatalogPort = 5432,
    [int]$FacilityPort = 5432,
    [int]$ShowtimePort = 5432,
    [int]$BookingPort = 5432,
    [string]$User = "postgres",
    [string]$DumpDir = "infrastructure/migrations/dumps",
    [string]$ManifestFile = "",
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

function Test-RestoreCompatibility {
    param(
        [string]$Database,
        [int]$DbPort
    )

    if ($DryRun) {
        Write-Host "DRY RUN: verify pg_restore major version is not newer than $Database server on $DbHost`:$DbPort"
        return
    }

    $versionOutput = & $PgRestore --version
    if ($LASTEXITCODE -ne 0 -or ($versionOutput -join " ") -notmatch '(\d+)(?:\.\d+)?') {
        throw "Could not determine pg_restore version from: $PgRestore"
    }
    $clientMajor = [int]$Matches[1]

    $serverVersionArgs = @(
        "--host", $DbHost,
        "--port", "$DbPort",
        "--username", $User,
        "--no-password",
        "--dbname", $Database,
        "--tuples-only",
        "--no-align",
        "--command", "SHOW server_version_num;"
    )
    $serverVersionOutput = & $Psql @serverVersionArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Could not determine PostgreSQL server version for $Database"
    }
    $serverVersionNumber = [int](($serverVersionOutput | Select-Object -Last 1).Trim())
    $serverMajor = [Math]::Floor($serverVersionNumber / 10000)
    if ($clientMajor -gt $serverMajor) {
        throw "pg_restore $clientMajor is newer than target PostgreSQL $serverMajor for $Database. Use client tools matching the target major version."
    }
}

function Test-DumpChecksum {
    param(
        [string]$ServiceName,
        [string]$DumpFile
    )

    if ($DryRun) {
        Write-Host "DRY RUN: verify $ServiceName dump against SHA-256 manifest $ResolvedManifestFile"
        return
    }

    $entry = @($Manifest.services | Where-Object { $_.service -eq $ServiceName }) | Select-Object -First 1
    if ($null -eq $entry) {
        throw "Manifest does not contain service entry: $ServiceName"
    }
    if ([IO.Path]::GetFileName($DumpFile) -ne [string]$entry.file) {
        throw "Manifest file mismatch for $ServiceName`: expected $($entry.file), got $([IO.Path]::GetFileName($DumpFile))"
    }

    $actualHash = (Get-FileHash -LiteralPath $DumpFile -Algorithm SHA256).Hash
    if (-not $actualHash.Equals([string]$entry.sha256, [StringComparison]::OrdinalIgnoreCase)) {
        throw "SHA-256 mismatch for $ServiceName dump; restore aborted before target mutation"
    }
    Write-Host "Verified SHA-256 for $ServiceName dump"
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
$ResolvedManifestFile = if ([string]::IsNullOrWhiteSpace($ManifestFile)) {
    Join-Path $DumpDir "migration-manifest.json"
} else {
    $ManifestFile
}
$Manifest = $null
if (-not $DryRun) {
    if (-not (Test-Path -LiteralPath $ResolvedManifestFile)) {
        throw "Missing migration manifest: $ResolvedManifestFile"
    }
    $Manifest = Get-Content -LiteralPath $ResolvedManifestFile -Raw | ConvertFrom-Json
    if ($Manifest.formatVersion -ne 1) {
        throw "Unsupported migration manifest format: $($Manifest.formatVersion)"
    }
}

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
    Test-RestoreCompatibility $target.db $targetPort
    Test-DumpChecksum $serviceName $dumpFile
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
