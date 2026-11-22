[CmdletBinding()]
param(
    [string]$Script = "/scripts/showtime-test.js",
    [switch]$Build,
    [switch]$KeepRunning
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ComposeFile = Join-Path $ScriptDir "docker-compose-loadtest.yml"
$EnvFile = Join-Path $ScriptDir ".env"
$Profile = "gateway"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  Cinema Booking System - Gateway Load Test      " -ForegroundColor Cyan
Write-Host "  Profile : $Profile" -ForegroundColor Cyan
Write-Host "  Script  : $Script" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

function Compose { docker compose --project-directory $ScriptDir --profile $Profile -f $ComposeFile --env-file $EnvFile @args }

try {
    # ---------------------------------------------------------------
    # 1. Build (optional) and start gateway profile containers
    # ---------------------------------------------------------------
    if ($Build) {
        Write-Host "`nBuilding images for profile '$Profile'..." -ForegroundColor Green
        Compose build
    }

    Write-Host "`nStarting containers for profile '$Profile'..." -ForegroundColor Green
    Compose up -d --remove-orphans

    # ---------------------------------------------------------------
    # 2. Wait for Keycloak health (port 9000) & Realm (port 8080)
    # ---------------------------------------------------------------
    Write-Host "`nWaiting for Keycloak health endpoint (port 9000)..." -ForegroundColor Yellow
    $keycloakHealthy = $false
    $attempt = 0
    while (-not $keycloakHealthy -and $attempt -lt 60) {
        $attempt++
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:9000/health/ready" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                $keycloakHealthy = $true
                Write-Host "  Keycloak health: UP (attempt $attempt)." -ForegroundColor Green
            }
        } catch {}
        if (-not $keycloakHealthy) {
            Write-Host "  Polling Keycloak health... (attempt $attempt/60)" -ForegroundColor DarkYellow
            Start-Sleep -Seconds 5
        }
    }
    if (-not $keycloakHealthy) {
        Write-Warning "Keycloak health endpoint not ready after 60 attempts."
    }

    Write-Host "Verifying realm 'cinema-booking' is available..." -ForegroundColor Yellow
    $realmReady = $false
    $attempt = 0
    while (-not $realmReady -and $attempt -lt 30) {
        $attempt++
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8080/realms/cinema-booking" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                $realmReady = $true
                Write-Host "  Realm 'cinema-booking' is available." -ForegroundColor Green
            }
        } catch {}
        if (-not $realmReady) { Start-Sleep -Seconds 3 }
    }

    Write-Host "Waiting 15 seconds for API Gateway + Identity Service to stabilize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15

    # ---------------------------------------------------------------
    # 3. Seed test data
    # ---------------------------------------------------------------
    Write-Host "`nSeeding test showtime and seat inventory..." -ForegroundColor Yellow
    $SeedFile = Join-Path $ScriptDir "data\seed-showtime.sql"
    Get-Content $SeedFile -Raw | docker exec -i lt-postgres psql -U postgres

    # ---------------------------------------------------------------
    # 4. Run k6 load test
    # ---------------------------------------------------------------
    $SummaryFile = Join-Path $ScriptDir "scripts\summary.json"
    if (Test-Path $SummaryFile) { Remove-Item $SummaryFile -Force }

    Write-Host "`nExecuting k6 load test via Gateway..." -ForegroundColor Green

    $k6EnvArgs = @(
        "-e", "GATEWAY_URL=http://api-gateway",
        "-e", "SHOWTIME_URL=http://showtime-service:8082",
        "-e", "KEYCLOAK_URL=http://keycloak:8080"
    )

    $runArgs = @("run", "--rm") + $k6EnvArgs + @("k6", "run", "--summary-export=/scripts/summary.json", $Script)
    Compose @runArgs
    $k6ExitCode = $LASTEXITCODE

} finally {
    # ---------------------------------------------------------------
    # 5. Teardown
    # ---------------------------------------------------------------
    if (-not $KeepRunning) {
        Write-Host "`nTearing down test environment..." -ForegroundColor Yellow
        Compose down -v 2>$null
        Write-Host "[Done] Load test environment cleanly removed.`n" -ForegroundColor Green
    } else {
        Write-Host "`nContainers kept running as requested (-KeepRunning).`n" -ForegroundColor Cyan
    }

    # ---------------------------------------------------------------
    # 6. Parse and display summary
    # ---------------------------------------------------------------
    $SummaryFile = Join-Path $ScriptDir "scripts\summary.json"
    if (Test-Path $SummaryFile) {
        try {
            $raw = Get-Content $SummaryFile -Raw | ConvertFrom-Json
            $m = $raw.metrics
            
            Write-Host ""
            Write-Host "=================================================" -ForegroundColor Cyan
            Write-Host "  LOAD TEST RESULT SUMMARY  [$Profile]" -ForegroundColor Cyan
            Write-Host "=================================================" -ForegroundColor Cyan
            
            $reqCount = $m.http_reqs.count
            $reqRate = [Math]::Round($m.http_reqs.rate, 2)
            $failPct = [Math]::Round(($m.http_req_failed.value * 100), 2)
            $failCount = $m.http_req_failed.passes
            
            Write-Host "HTTP Requests:" -ForegroundColor White
            Write-Host "  Total : $reqCount ($reqRate req/s)"
            Write-Host "  Failed: $failPct% ($failCount network errors)"
            
            Write-Host "`nLatency Benchmarks:" -ForegroundColor White
            if ($m.http_req_duration) {
                $dur = $m.http_req_duration
                Write-Host "  Overall HTTP      : med=$([Math]::Round($dur.med, 1))ms | p(90)=$([Math]::Round($dur.'p(90)', 1))ms | p(95)=$([Math]::Round($dur.'p(95)', 1))ms | max=$([Math]::Round($dur.max, 1))ms"
            }
            if ($m.seat_map_duration_ms) {
                $sm = $m.seat_map_duration_ms
                Write-Host "  Seat Map Query    : med=$([Math]::Round($sm.med, 1))ms | p(90)=$([Math]::Round($sm.'p(90)', 1))ms | p(95)=$([Math]::Round($sm.'p(95)', 1))ms"
            }
            if ($m.seat_hold_duration_ms) {
                $sh = $m.seat_hold_duration_ms
                Write-Host "  Seat Hold Lock    : med=$([Math]::Round($sh.med, 1))ms | p(90)=$([Math]::Round($sh.'p(90)', 1))ms | p(95)=$([Math]::Round($sh.'p(95)', 1))ms"
            }

            Write-Host "`nSeat Concurrency & Contention:" -ForegroundColor White
            $holds = if ($m.successful_seat_holds) { $m.successful_seat_holds.count } else { 0 }
            $conflicts = if ($m.conflict_seat_holds) { $m.conflict_seat_holds.count } else { 0 }
            Write-Host "  Successful Holds: $holds"
            Write-Host "  Lock Conflicts  : $conflicts (prevented double-booking)"
            
            if ($raw.setup_data -and $raw.setup_data.PSObject.Properties['token']) {
                if ($raw.setup_data.token) {
                    Write-Host "`nAuthentication: OK (Keycloak JWT token acquired)" -ForegroundColor Green
                } else {
                    Write-Host "`nAuthentication: FAILED to acquire token" -ForegroundColor Red
                }
            }
            
            Write-Host "=================================================" -ForegroundColor Cyan
        } catch {
            Write-Warning "Could not format summary.json: $_"
        }
    }
}
