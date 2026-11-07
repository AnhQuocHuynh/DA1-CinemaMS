# Microservice Load & Stress Testing Suite

This directory contains modular, isolated load testing setups for the Cinema Booking System. It uses Docker Compose **profiles** to spin up **only the services needed** for each test scenario, drastically saving CPU, RAM, and boot time.

---

## Directory Structure

```text
tests/load/
├── docker-compose-loadtest.yml           # Unified Compose file with profiles (showtime, gateway, all)
├── run-loadtest.ps1                      # Master dispatcher (-Profile showtime|gateway|all)
├── run-showtime-test.ps1                 # Specific runner for Showtime flow
├── run-gateway-test.ps1                  # Specific runner for API Gateway & IAM flow
├── keycloak-config/
│   └── cinema-booking-realm.json         # Dedicated test realm (directAccessGrantsEnabled=true for k6)
├── data/
│   └── seed-showtime.sql                 # Automated SQL seed script for test showtimes & seats
├── scripts/
│   ├── showtime-test.js                  # k6 scenario (direct or gateway seat map & seat contention)
│   └── cache-benchmark.mjs               # Redis cache hit vs cold DB resolution benchmark
├── .env.example                          # Sample environment configuration
└── README.md
```

---

## Profiles & Architecture

| Profile | Specific Runner | Services Started | Use Case | Auth / Keycloak | Startup Time |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`showtime`** *(default)* | `run-showtime-test.ps1` | `postgres`, `showtime-redis`, `catalog-service`, `facility-service`, `showtime-service`, `k6` | High-concurrency seat locking contention, distributed lock performance | **Skipped** (direct internal user simulation via synthetic `X-User-Id`) | ~10s |
| **`gateway`** | `run-gateway-test.ps1` | All above + `redis`, `rabbitmq`, `keycloak`, `identity-service`, `api-gateway` | End-to-end API Gateway routing, rate limiting, and Keycloak JWT validation | **Enabled** (JWT obtained from Keycloak) | ~45-60s |
| **`all`** | `run-gateway-test.ps1` | Every microservice and dependency | Full-system stress testing | **Enabled** | ~60s+ |

---

## How to Run

### Method 1: Using the Master Dispatcher (`run-loadtest.ps1`)
The master runner calls the appropriate specific runner based on `-Profile`:
```powershell
# Run Showtime load test
.\tests\load\run-loadtest.ps1 -Profile showtime

# Run Gateway load test
.\tests\load\run-loadtest.ps1 -Profile gateway

# Build images before running
.\tests\load\run-loadtest.ps1 -Profile showtime -Build

# Keep containers running after test completes
.\tests\load\run-loadtest.ps1 -Profile showtime -KeepRunning
```

### Method 2: Running Specific Test Scripts Directly
You can also directly invoke the dedicated script for each scenario:

#### A. Showtime Seat Locking Contention Test
Starts only Postgres, Redis, and Showtime Service dependencies. Fast startup (~10s).
```powershell
.\tests\load\run-showtime-test.ps1

# Options:
.\tests\load\run-showtime-test.ps1 -Build
.\tests\load\run-showtime-test.ps1 -KeepRunning
.\tests\load\run-showtime-test.ps1 -Script /scripts/custom-test.js
```

#### B. Gateway & Authentication Load Test
Starts the full stack including Keycloak and API Gateway to test gateway throughput, rate limiting, and JWT decoding.
```powershell
.\tests\load\run-gateway-test.ps1

# Options:
.\tests\load\run-gateway-test.ps1 -Build
.\tests\load\run-gateway-test.ps1 -KeepRunning
```

---

## Metric Expectations & Thresholds

- **Seat Locking Contention (409 Conflict)**: In contention tests where multiple VUs target a small set of seats, `409 Conflict` is an expected and desired business result indicating that Redis distributed locks prevented duplicate seat bookings. k6 is configured with `responseCallback: http.expectedStatuses(200, 409)` so these do not artificially count as failed HTTP requests.
- **Seat Map Latency**: p(95) < 500ms.
- **Seat Hold Latency**: Typically < 10ms with Redis distributed locks.
