[CmdletBinding()]
param(
    [switch]$StartCompose,
    [switch]$StopCompose,
    [switch]$ValidateOnly,
    [switch]$KeepEvidence,
    [int]$TimeoutSeconds = 120,
    [string]$RabbitManagementUrl = "http://localhost:15672",
    [string]$RabbitUsername = "cinema",
    [string]$RabbitPassword = "cinema-rabbitmq-dev",
    [string]$RecommendationUrl = "http://localhost:8085",
    [string]$Neo4jPassword = "cinema_graph_2026"
)

$ErrorActionPreference = "Stop"

function Invoke-Compose {
    param([string[]]$Arguments)

    & docker compose -f $ComposeFile @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose failed: $($Arguments -join ' ')"
    }
}

function Wait-Until {
    param(
        [string]$Name,
        [scriptblock]$Condition
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $lastError = $null
    do {
        try {
            if (& $Condition) {
                Write-Host "[OK] $Name"
                return
            }
        } catch {
            $lastError = $_.Exception.Message
        }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)

    $suffix = if ($null -eq $lastError) { "" } else { " Last error: $lastError" }
    throw "[FAIL] Timed out waiting for $Name.$suffix"
}

function New-EventEnvelope {
    param(
        [Guid]$EventId,
        [string]$Source,
        [string]$EventType,
        [string]$AggregateType,
        [long]$AggregateId,
        [DateTimeOffset]$OccurredAt,
        [hashtable]$Payload
    )

    return [ordered]@{
        eventId = $EventId.ToString()
        schemaVersion = 1
        source = $Source
        eventType = $EventType
        aggregateType = $AggregateType
        aggregateId = $AggregateId
        occurredAt = $OccurredAt.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        payload = $Payload
    }
}

function Invoke-RabbitPublish {
    param(
        [string]$Exchange,
        [string]$RoutingKey,
        [hashtable]$Envelope
    )

    $pair = "${RabbitUsername}:${RabbitPassword}"
    $basicToken = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
    $headers = @{ Authorization = "Basic $basicToken" }
    $encodedExchange = [Uri]::EscapeDataString($Exchange)
    $uri = "$($RabbitManagementUrl.TrimEnd('/'))/api/exchanges/%2F/$encodedExchange/publish"
    $message = $Envelope | ConvertTo-Json -Depth 12 -Compress
    $body = @{
        properties = @{ content_type = "application/json" }
        routing_key = $RoutingKey
        payload = $message
        payload_encoding = "string"
    } | ConvertTo-Json -Depth 12 -Compress

    $result = Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -ContentType "application/json" -Body $body -TimeoutSec 10
    if ($result.routed -ne $true) {
        throw "RabbitMQ did not route $RoutingKey on $Exchange"
    }
}

function Invoke-AnalyticsScalar {
    param([string]$Sql)

    $output = & docker exec cinema-postgres psql `
        --username postgres `
        --dbname cinema_analytics_db `
        --tuples-only `
        --no-align `
        --command $Sql
    if ($LASTEXITCODE -ne 0) {
        throw "Analytics verification query failed"
    }
    return (($output | Select-Object -Last 1).Trim())
}

function Invoke-AnalyticsCommand {
    param([string]$Sql)

    & docker exec cinema-postgres psql `
        --username postgres `
        --dbname cinema_analytics_db `
        --set ON_ERROR_STOP=1 `
        --command $Sql | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Analytics command failed"
    }
}

function Invoke-Neo4jScalar {
    param([string]$Cypher)

    $output = & docker exec cinema-neo4j cypher-shell `
        --username neo4j `
        --password $Neo4jPassword `
        --format plain `
        $Cypher
    if ($LASTEXITCODE -ne 0) {
        throw "Neo4j verification query failed"
    }
    return (($output | Select-Object -Last 1).Trim().Trim('"'))
}

function Invoke-Neo4jCommand {
    param([string]$Cypher)

    & docker exec cinema-neo4j cypher-shell `
        --username neo4j `
        --password $Neo4jPassword `
        $Cypher | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Neo4j command failed"
    }
}

function Get-AnalyticsState {
    param(
        [long]$OrderId,
        [string[]]$EventIds
    )

    $eventList = ($EventIds | ForEach-Object { "'$_'::uuid" }) -join ","
    $sql = @"
SELECT COALESCE((SELECT status FROM analytics_orders WHERE order_id = $OrderId), 'MISSING')
       || '|'
       || (SELECT COUNT(*) FROM analytics_processed_events WHERE event_id IN ($eventList));
"@
    return Invoke-AnalyticsScalar $sql
}

function Get-RecommendationState {
    param(
        [long]$MovieId,
        [long]$OrderId,
        [long]$UserId,
        [long]$ReviewId,
        [string[]]$EventIds
    )

    $eventList = ($EventIds | ForEach-Object { "'$_'" }) -join ","
    $cypher = @"
OPTIONAL MATCH (marker:ProcessedEvent)
WHERE marker.eventId IN [$eventList]
WITH count(marker) AS processed
OPTIONAL MATCH (order:OrderInteraction {orderId: $OrderId})
WITH processed, order
OPTIONAL MATCH (:User {userId: $UserId})-[watched:WATCHED {orderId: $OrderId}]->(:Movie {movieId: $MovieId})
WITH processed, order, count(watched) AS watchedCount
OPTIONAL MATCH (:User {userId: $UserId})-[rated:RATED {reviewId: $ReviewId}]->(:Movie {movieId: $MovieId})
WITH processed, order, watchedCount, count(rated) AS ratedCount
RETURN coalesce(order.status, 'MISSING') + '|' + toString(watchedCount) + '|' + toString(ratedCount) + '|' + toString(processed) AS result
"@
    return Invoke-Neo4jScalar $cypher
}

function Test-RecommendationApi {
    param(
        [long]$MovieId,
        [long]$ExpectedBookings,
        [decimal]$ExpectedRating
    )

    $uri = "$($RecommendationUrl.TrimEnd('/'))/api/recommendations/movies/popular?limit=1000"
    $response = Invoke-RestMethod -Uri $uri -Method GET -TimeoutSec 10
    $movie = @($response.data.recommendations | Where-Object { [long]$_.movieId -eq $MovieId }) | Select-Object -First 1
    if ($null -eq $movie) {
        return $false
    }
    return [long]$movie.bookingCount -eq $ExpectedBookings -and [decimal]$movie.avgRating -eq $ExpectedRating
}

function Remove-Evidence {
    param([hashtable]$Evidence)

    $eventListSql = ($Evidence.EventIds | ForEach-Object { "'$_'::uuid" }) -join ","
    $cleanupSql = @"
DELETE FROM analytics_processed_events WHERE event_id IN ($eventListSql);
DELETE FROM analytics_orders WHERE order_id = $($Evidence.OrderId);
DELETE FROM analytics_contents WHERE content_type = 'MOVIE' AND content_id = $($Evidence.MovieId);
"@
    Invoke-AnalyticsCommand $cleanupSql

    $eventListCypher = ($Evidence.EventIds | ForEach-Object { "'$_'" }) -join ","
    $cleanupCypher = @"
MATCH (marker:ProcessedEvent) WHERE marker.eventId IN [$eventListCypher] DETACH DELETE marker;
MATCH (node:OrderInteraction {orderId: $($Evidence.OrderId)}) DETACH DELETE node;
MATCH (node:ReviewInteraction {reviewId: $($Evidence.ReviewId)}) DETACH DELETE node;
MATCH (node:User {userId: $($Evidence.UserId)}) DETACH DELETE node;
MATCH (node:Movie {movieId: $($Evidence.MovieId)}) DETACH DELETE node;
MATCH (node:Genre {name: '$($Evidence.GenreName)'}) WHERE NOT ()-[:IN_GENRE]->(node) DELETE node;
"@
    Invoke-Neo4jCommand $cleanupCypher
    Write-Host "[OK] Removed event-flow test evidence"
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ComposeFile = Join-Path $ScriptDir "docker-compose.yml"
$SmokeScript = Join-Path $ScriptDir "smoke-test.ps1"

if ($ValidateOnly) {
    Write-Host "Event-flow smoke configuration is valid."
    Write-Host "RabbitMQ management: $RabbitManagementUrl"
    Write-Host "Recommendation: $RecommendationUrl"
    return
}

$evidence = $null
try {
    if ($StartCompose) {
        & $SmokeScript -StartCompose -TimeoutSeconds $TimeoutSeconds
    } else {
        & $SmokeScript -TimeoutSeconds $TimeoutSeconds
    }

    $baseId = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $movieId = $baseId
    $orderId = $baseId + 1
    $userId = $baseId + 2
    $showtimeId = $baseId + 3
    $reviewId = $baseId + 4
    $genreName = "E2E-$baseId"
    $baseTime = [DateTimeOffset]::UtcNow.AddMinutes(-10)

    $movieEventId = [Guid]::NewGuid()
    $paidEventId = [Guid]::NewGuid()
    $refundEventId = [Guid]::NewGuid()
    $stalePaidEventId = [Guid]::NewGuid()
    $reviewEventId = [Guid]::NewGuid()
    $eventIds = @(
        $movieEventId.ToString(),
        $paidEventId.ToString(),
        $refundEventId.ToString(),
        $stalePaidEventId.ToString(),
        $reviewEventId.ToString()
    )
    $evidence = @{
        MovieId = $movieId
        OrderId = $orderId
        UserId = $userId
        ReviewId = $reviewId
        GenreName = $genreName
        EventIds = $eventIds
    }

    $movieEnvelope = New-EventEnvelope `
        -EventId $movieEventId `
        -Source "catalog-service" `
        -EventType "movie.created" `
        -AggregateType "movie" `
        -AggregateId $movieId `
        -OccurredAt $baseTime.AddMinutes(1) `
        -Payload @{
            movieId = $movieId
            title = "Event Flow $baseId"
            active = $true
            genreIds = @($movieId)
            genreNames = @($genreName)
            posterUrl = $null
        }
    $paidEnvelope = New-EventEnvelope `
        -EventId $paidEventId `
        -Source "booking-service" `
        -EventType "order.paid" `
        -AggregateType "order" `
        -AggregateId $orderId `
        -OccurredAt $baseTime.AddMinutes(3) `
        -Payload @{
            orderId = $orderId
            userId = $userId
            showtimeId = $showtimeId
            movieId = $movieId
            eventId = $null
            totalAmount = 125000
            finalAmount = 125000
            ticketCount = 2
            paymentMethod = "E2E"
            transactionId = "e2e-$baseId"
        }

    Invoke-RabbitPublish "catalog.events" "movie.created" $movieEnvelope
    Invoke-RabbitPublish "catalog.events" "movie.created" $movieEnvelope
    Invoke-RabbitPublish "booking.events" "order.paid" $paidEnvelope
    Invoke-RabbitPublish "booking.events" "order.paid" $paidEnvelope

    Wait-Until "Analytics projected paid state exactly once" {
        (Get-AnalyticsState $orderId @($movieEventId.ToString(), $paidEventId.ToString())) -eq "PAID|2"
    }
    Wait-Until "Recommendation projected paid state exactly once" {
        (Get-RecommendationState $movieId $orderId $userId $reviewId @($movieEventId.ToString(), $paidEventId.ToString())) -eq "PAID|1|0|2"
    }
    Wait-Until "Recommendation API exposes paid interaction" {
        Test-RecommendationApi $movieId 1 0
    }

    $refundEnvelope = New-EventEnvelope `
        -EventId $refundEventId `
        -Source "booking-service" `
        -EventType "order.refunded" `
        -AggregateType "order" `
        -AggregateId $orderId `
        -OccurredAt $baseTime.AddMinutes(5) `
        -Payload @{
            orderId = $orderId
            userId = $userId
            showtimeId = $showtimeId
            finalAmount = 125000
            ticketCount = 2
        }
    $stalePaidEnvelope = New-EventEnvelope `
        -EventId $stalePaidEventId `
        -Source "booking-service" `
        -EventType "order.paid" `
        -AggregateType "order" `
        -AggregateId $orderId `
        -OccurredAt $baseTime.AddMinutes(2) `
        -Payload $paidEnvelope.payload
    $reviewEnvelope = New-EventEnvelope `
        -EventId $reviewEventId `
        -Source "booking-service" `
        -EventType "review.created" `
        -AggregateType "review" `
        -AggregateId $reviewId `
        -OccurredAt $baseTime.AddMinutes(6) `
        -Payload @{
            reviewId = $reviewId
            userId = $userId
            movieId = $movieId
            eventId = $null
            rating = 5
            status = "VISIBLE"
            createdAt = $baseTime.AddMinutes(6).ToString("o")
        }

    Invoke-RabbitPublish "booking.events" "order.refunded" $refundEnvelope
    Invoke-RabbitPublish "booking.events" "order.paid" $stalePaidEnvelope
    Invoke-RabbitPublish "booking.events" "review.created" $reviewEnvelope

    Wait-Until "Analytics keeps refund after stale paid event" {
        (Get-AnalyticsState $orderId @($movieEventId.ToString(), $paidEventId.ToString(), $refundEventId.ToString(), $stalePaidEventId.ToString())) -eq "REFUNDED|4"
    }
    Wait-Until "Recommendation keeps refund and visible review after stale paid event" {
        (Get-RecommendationState $movieId $orderId $userId $reviewId $eventIds) -eq "REFUNDED|0|1|5"
    }
    Wait-Until "Recommendation API reflects refund and rating" {
        Test-RecommendationApi $movieId 0 5
    }

    Write-Host "[OK] End-to-end event flow passed."
} finally {
    if ($null -ne $evidence -and -not $KeepEvidence) {
        try {
            Remove-Evidence $evidence
        } catch {
            Write-Warning "Could not remove event-flow evidence: $($_.Exception.Message)"
        }
    }
    if ($StopCompose) {
        Invoke-Compose -Arguments @("down")
    }
}
