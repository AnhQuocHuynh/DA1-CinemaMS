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

function Get-TableFingerprint {
    param(
        [string]$Database,
        [int]$DbPort,
        [string]$TableName
    )

    $sql = @"
SELECT CASE
    WHEN to_regclass('public.$TableName') IS NULL THEN 'MISSING'
    ELSE (
        SELECT COUNT(*)::text
               || ':' || COALESCE(SUM(hashtextextended(to_jsonb(row_data)::text, 0)::numeric), 0)::text
               || ':' || COALESCE(SUM(hashtextextended(to_jsonb(row_data)::text, 2147483647)::numeric), 0)::text
        FROM public.$TableName row_data
    )
END;
"@
    return Invoke-PsqlScalar $Database $DbPort $sql
}

function Get-TableSequenceState {
    param(
        [string]$Database,
        [int]$DbPort,
        [string]$TableName
    )

    if ($DryRun) {
        Write-Host "DRY RUN: verify sequence state for $Database.public.$TableName on $DbHost`:$DbPort"
        return [PSCustomObject]@{
            Present = $false
            Ready = $true
            Fingerprint = "DRY_RUN"
            Detail = "dry-run"
        }
    }

    $sequenceSql = @"
SELECT CASE
    WHEN EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '$TableName'
          AND column_name = 'id'
    ) THEN COALESCE(pg_get_serial_sequence('public.$TableName', 'id'), '')
    ELSE ''
END;
"@
    $sequenceName = Invoke-PsqlScalar $Database $DbPort $sequenceSql
    if ([string]::IsNullOrWhiteSpace($sequenceName)) {
        return [PSCustomObject]@{
            Present = $false
            Ready = $true
            Fingerprint = "NONE"
            Detail = "none"
        }
    }

    $escapedSequenceName = $sequenceName.Replace("'", "''")
    $stateSql = @"
SELECT last_value::text
       || ':' || is_called::text
       || ':' || (SELECT seqincrement::text FROM pg_sequence WHERE seqrelid = '$escapedSequenceName'::regclass)
FROM $sequenceName;
"@
    $stateParts = (Invoke-PsqlScalar $Database $DbPort $stateSql) -split ':'
    if ($stateParts.Count -ne 3) {
        throw "Could not read sequence state for $Database.public.$TableName"
    }

    $lastValue = [decimal]$stateParts[0]
    $isCalled = $stateParts[1] -in @("t", "true", "1")
    $increment = [decimal]$stateParts[2]
    $maxId = [decimal](Invoke-PsqlScalar $Database $DbPort "SELECT COALESCE(MAX(id), 0)::text FROM public.$TableName;")
    $nextValue = if ($isCalled) { $lastValue + $increment } else { $lastValue }

    return [PSCustomObject]@{
        Present = $true
        Ready = $nextValue -gt $maxId
        Fingerprint = "$lastValue`:$isCalled`:$increment"
        Detail = "next=$nextValue max=$maxId"
    }
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
        $legacyFingerprint = Get-TableFingerprint $LegacyDb $LegacyPort $table
        $targetFingerprint = Get-TableFingerprint $target.db $targetPort $table
        $fingerprintStatus = if ($legacyFingerprint -eq $targetFingerprint) { "MATCH" } else { "MISMATCH" }
        $legacySequence = Get-TableSequenceState $LegacyDb $LegacyPort $table
        $targetSequence = Get-TableSequenceState $target.db $targetPort $table
        $sequenceStatus = if (-not $legacySequence.Ready) {
            "SOURCE_BEHIND"
        } elseif (-not $targetSequence.Ready) {
            "TARGET_BEHIND"
        } elseif ($legacySequence.Present -ne $targetSequence.Present) {
            "MISMATCH"
        } elseif (-not $legacySequence.Present) {
            "N/A"
        } elseif ($legacySequence.Fingerprint -eq $targetSequence.Fingerprint) {
            "MATCH"
        } else {
            "MISMATCH"
        }
        $status = if ($fingerprintStatus -eq "MATCH" -and $sequenceStatus -in @("MATCH", "N/A")) { "OK" } else { "MISMATCH" }
        $legacyCount = if ($DryRun) { "DRY_RUN" } else { ($legacyFingerprint -split ':', 2)[0] }
        $targetCount = if ($DryRun) { "DRY_RUN" } else { ($targetFingerprint -split ':', 2)[0] }

        [PSCustomObject]@{
            Service = $serviceName
            Table = $table
            LegacyCount = $legacyCount
            TargetCount = $targetCount
            ContentFingerprint = $fingerprintStatus
            SequenceState = $sequenceStatus
            Status = $status
        }

        if (-not $DryRun -and $status -ne "OK") {
            $mismatches += "$serviceName.$table rows=[$legacyFingerprint -> $targetFingerprint] sequence=[$sequenceStatus; source $($legacySequence.Detail); target $($targetSequence.Detail)]"
        }
    }
}

if ($mismatches.Count -gt 0) {
    throw "Data verification failed: $($mismatches -join '; ')"
}
