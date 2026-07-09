[CmdletBinding()]
param(
    [switch]$StartCompose,
    [switch]$StopCompose,
    [switch]$ValidateOnly,
    [int]$TimeoutSeconds = 120,
    [string]$InternalToken = "",
    [string]$CatalogUrl = "",
    [string]$FacilityUrl = "",
    [string]$ShowtimeUrl = "",
    [string]$BookingUrl = "",
    [string]$AnalyticsUrl = "",
    [string]$RecommendationUrl = "",
    [switch]$SkipAnalytics,
    [switch]$SkipRecommendation
)

$ErrorActionPreference = "Stop"

function Resolve-Default {
    param(
        [string]$Value,
        [string]$Fallback
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $Fallback
    }

    return $Value
}

function Join-ServiceUrl {
    param(
        [string]$BaseUrl,
        [string]$Path
    )

    return $BaseUrl.TrimEnd("/") + $Path
}

function Invoke-Compose {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )

    & docker compose -f $ComposeFile @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose failed: $($Arguments -join ' ')"
    }
}

function Get-HttpStatus {
    param(
        [string]$Uri,
        [hashtable]$Headers = @{}
    )

    try {
        $response = Invoke-WebRequest -Uri $Uri -Method GET -Headers $Headers -UseBasicParsing -TimeoutSec 10
        return [int]$response.StatusCode
    } catch {
        $response = $_.Exception.Response
        if ($null -ne $response -and $null -ne $response.StatusCode) {
            return [int]$response.StatusCode
        }

        return 0
    }
}

function Wait-Health {
    param(
        [string]$Name,
        [string]$BaseUrl
    )

    $uri = Join-ServiceUrl $BaseUrl "/actuator/health"
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $status = 0

    do {
        $status = Get-HttpStatus -Uri $uri
        if ($status -ge 200 -and $status -lt 300) {
            Write-Host "[OK] $Name health returned HTTP $status"
            return
        }

        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)

    throw "[FAIL] $Name health did not return 2xx before timeout. Last HTTP status: $status ($uri)"
}

function Assert-InternalEndpoint {
    param(
        [string]$Name,
        [string]$BaseUrl,
        [string]$Path
    )

    $uri = Join-ServiceUrl $BaseUrl $Path
    $withoutToken = Get-HttpStatus -Uri $uri
    if ($withoutToken -ne 401 -and $withoutToken -ne 403) {
        throw "[FAIL] $Name allowed internal access without token. HTTP status: $withoutToken ($uri)"
    }

    $headers = @{ "X-Internal-Token" = $InternalToken }
    $withToken = Get-HttpStatus -Uri $uri -Headers $headers
    if ($withToken -eq 0 -or $withToken -eq 401 -or $withToken -eq 403 -or $withToken -ge 500) {
        throw "[FAIL] $Name did not accept internal token cleanly. HTTP status: $withToken ($uri)"
    }

    Write-Host "[OK] $Name internal token guard returned HTTP $withToken"
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ComposeFile = Join-Path $ScriptDir "docker-compose.yml"

$InternalToken = Resolve-Default $InternalToken (Resolve-Default $env:INTERNAL_API_TOKEN "local-dev-internal-token")
$CatalogUrl = Resolve-Default $CatalogUrl (Resolve-Default $env:CATALOG_SERVICE_URL "http://localhost:8081")
$FacilityUrl = Resolve-Default $FacilityUrl (Resolve-Default $env:FACILITY_SERVICE_URL "http://localhost:5002")
$ShowtimeUrl = Resolve-Default $ShowtimeUrl (Resolve-Default $env:SHOWTIME_SERVICE_URL "http://localhost:8082")
$BookingUrl = Resolve-Default $BookingUrl (Resolve-Default $env:BOOKING_SERVICE_URL "http://localhost:8083")
$AnalyticsUrl = Resolve-Default $AnalyticsUrl (Resolve-Default $env:ANALYTICS_SERVICE_URL "http://localhost:8084")
$RecommendationUrl = Resolve-Default $RecommendationUrl (Resolve-Default $env:RECOMMENDATION_SERVICE_URL "http://localhost:8085")

if ($ValidateOnly) {
    Write-Host "Smoke test script configuration is valid."
    Write-Host "Catalog:  $CatalogUrl"
    Write-Host "Facility: $FacilityUrl"
    Write-Host "Showtime: $ShowtimeUrl"
    Write-Host "Booking:  $BookingUrl"
    Write-Host "Analytics: $AnalyticsUrl"
    Write-Host "Recommendation: $RecommendationUrl"
    return
}

if ($StartCompose) {
    Invoke-Compose config
    Invoke-Compose up -d --build
}

try {
    Wait-Health "catalog-service" $CatalogUrl
    Wait-Health "facility-service compatibility dependency" $FacilityUrl
    Wait-Health "showtime-service" $ShowtimeUrl
    Wait-Health "booking-service" $BookingUrl
    if (-not $SkipAnalytics) {
        Wait-Health "analytics-service" $AnalyticsUrl
    }
    if (-not $SkipRecommendation) {
        Wait-Health "recommendation-service" $RecommendationUrl
    }

    Assert-InternalEndpoint "Catalog movie projection" $CatalogUrl "/internal/catalog/movies/1"
    Assert-InternalEndpoint "Catalog event projection" $CatalogUrl "/internal/catalog/events/1"
    Assert-InternalEndpoint "Facility room projection" $FacilityUrl "/internal/facility/rooms/1"
    Assert-InternalEndpoint "Facility seat-template projection" $FacilityUrl "/internal/facility/seat-templates/1"
    Assert-InternalEndpoint "Showtime room guard" $ShowtimeUrl "/internal/showtimes/rooms/1/future-exists"

    Write-Host "[OK] Runtime smoke tests passed."
} finally {
    if ($StopCompose) {
        Invoke-Compose down
    }
}
