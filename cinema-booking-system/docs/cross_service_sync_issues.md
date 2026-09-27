# Cross-Service Sync Issues — Post-Merge Audit

> **Date**: 2026-08-17  
> **Branch**: `refactor-compose-single-postgres`  
> **Status**: All containers start successfully, but runtime inter-service calls will fail in several areas.

## Reference Documents

| Document | Purpose |
|---|---|
| [`SESSION_BOOTSTRAP.md`](file:///c:/DoAn1/DA1-CinemaMS/docs/SESSION_BOOTSTRAP.md) | Session entry point, ownership matrix, safe next order |
| [`CURRENT_STATE.md`](file:///c:/DoAn1/DA1-CinemaMS/docs/CURRENT_STATE.md) | Operational snapshot, ports, verification commands |
| [`authentication_integration_contract.md`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/docs/authentication_integration_contract.md) | Approved auth contract — Sections 6, 7, 9 are most relevant |
| [`CONTEXT.md`](file:///c:/DoAn1/DA1-CinemaMS/docs/CONTEXT.md) | Stable product context, tech stack, architecture |

> [!IMPORTANT]
> Per the ownership matrix in SESSION_BOOTSTRAP.md, **facility-service, identity-service, payment-service, notification-service, and api-gateway are ASP.NET-owned**. Spring Boot owns catalog, showtime, booking, analytics, and recommendation. Issues below affect the boundary between both workstreams.

---

## Summary

| #  | Category                 | Severity     | Services Affected                                   |
|----|--------------------------|--------------|------------------------------------------------------|
| 1  | Missing Internal APIs    | ✅ Resolved   | facility-service (.NET) ← showtime / booking (Java)  |
| 2  | Auth Scheme Mismatch     | ✅ Resolved   | facility-service (.NET) ← all Spring Boot callers    |
| 3  | JWT Issuer Validation    | ✅ Resolved   | facility-service (.NET), identity-service (.NET)      |
| 4  | API Gateway Route Gaps   | ✅ Resolved   | api-gateway → catalog / showtime / booking / etc.    |
| 5  | Unresolved Merge Conflict| ✅ Resolved  | `shared/contracts/facility-service.openapi.yml`       |
| 14 | ValidateIssuer=false     | ✅ Resolved   | api-gateway (violates auth contract §6)               |
| 6  | RabbitMQ Config Keys     | ✅ Resolved   | payment-service (.NET) vs identity-service (.NET)     |
| 7  | `.env.example` Drift     | ✅ Resolved   | docker-compose.yml vs `.env.example`                  |
| 8  | Payment & Notification   |  Partially Resolved | payment-service, notification-service                 |
| 9  | Facility Showtime Guard  | ✅ Resolved   | facility-service (.NET)                               |
| 10 | User Events Consumer Gap | ✅ Resolved   | recommendation-service (Java)                         |
| 11 | Response Envelope Shape  | ✅ Resolved   | facility-service (.NET) internal response             |
| 12 | Health Check Path        | ✅ Resolved   | facility-service (.NET) vs Spring Boot services       |
| 13 | Facility DB Name         | ✅ Resolved   | Java facility-service config residue                  |

---

## 1. ✅ Missing Internal API Endpoints on .NET Facility Service

**Status:** Resolved. Added `InternalFacilityController` and internal queries to expose the missing endpoints wrapped in `ApiResponse<T>`.

**Problem:** The Spring Boot services (`showtime-service`, `booking-service`) make HTTP calls to the facility service using these endpoints:

| Expected Endpoint (Spring Boot callers)             | Exists in .NET Facility Service? |
|------------------------------------------------------|----------------------------------|
| `GET /internal/facility/rooms/{roomId}`               | ❌ **No**                        |
| `GET /internal/facility/seat-templates/{seatTemplateId}` | ❌ **No**                     |
| `GET /internal/facility/rooms/{roomId}/seat-templates`| ❌ **No**                        |

The .NET facility service only exposes:
- `GET /api/cinemas` — public cinema list  
- `GET /api/cinemas/{cinemaId}/rooms/{roomId}` — room by cinema (requires `cinemaId`)  
- `GET /api/cinemas/{cinemaId}/rooms/{roomId}/seats` — seat templates (public)  
- `GET /internal/rooms/{roomId}/seats` — internal seat list (different path & different response shape)  

**Impact:** Every `showtime-service` and `booking-service` call to enrich room/seat data will fail with 404. These services swallow errors gracefully (returning `Optional.empty()`), so they won't crash, but **all room names, cinema names, seat labels, and seat type info will be null/missing** in API responses.

**Files involved:**
- [`HttpFacilityReadService.java` (showtime)](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/showtime-service/src/main/java/com/uit/cinema/showtime/client/HttpFacilityReadService.java)
- [`HttpFacilityReadService.java` (booking)](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/booking-service/src/main/java/com/uit/cinema/booking/client/HttpFacilityReadService.java)
- [`SeatTemplatesController.cs`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/facility-service/FacilityService.Presentation/Controllers/SeatTemplatesController.cs)
- [`RoomsController.cs`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/facility-service/FacilityService.Presentation/Controllers/RoomsController.cs)

**Fix required:** Add three new internal endpoints to the .NET facility service:
1. `GET /internal/facility/rooms/{roomId}` — returns `FacilityRoomView` (roomId, roomName, cinemaId, cinemaName, underMaintenance)
2. `GET /internal/facility/seat-templates/{seatTemplateId}` — returns `FacilitySeatTemplateView` (single seat template)
3. `GET /internal/facility/rooms/{roomId}/seat-templates` — returns `List<FacilitySeatTemplateView>` (active templates for a room)

All three must be wrapped in the Java-side `ApiResponse<T>` envelope (`{ "success": true, "data": ... }`).

---

## 2. ✅ Internal Token Auth Not Implemented in .NET Services

**Status:** Resolved. Added `InternalApiSecurityMiddleware` to `.NET` services (`facility-service`, `identity-service`, `payment-service`) that validates the `X-Internal-Token` header.

> [!NOTE]
> Per the [authentication contract §9.3](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/docs/authentication_integration_contract.md), `X-Internal-Token` is a **temporary compatibility mechanism**. The target is Keycloak client-credentials tokens. However, for the current merge to work, both sides must use the same transitional mechanism.

**Problem:** All Spring Boot services attach an `X-Internal-Token` header when calling internal endpoints:

```java
.defaultHeader("X-Internal-Token", internalToken)  // from app.internal-token config
```

The Spring Boot services (catalog, showtime, booking, facility-java) all have an `InternalApiSecurityFilter` that validates this token on `/internal/**` routes.

**The .NET facility-service has no such filter.** The internal endpoint `GET /internal/rooms/{roomId}/seats` is marked `[AllowAnonymous]` and relies solely on the API gateway blocking external `/internal/*` routes. This means:
- No authentication on internal calls — any container on the Docker network can access them.
- The `X-Internal-Token` header sent by Java callers is silently ignored.

**The .NET identity-service** similarly has `[AllowAnonymous]` on `GET /internal/users/resolve` with no token validation.

**Fix implemented:**
- **(A)** Added an `InternalApiSecurityMiddleware` to .NET services that validates the `X-Internal-Token` header against a shared secret matching the Spring Boot `app.internal-token` value (via `InternalApi:Token` configuration).


---

## 3. ✅ JWT Issuer Validation Mismatch (see also Issue #14)

**Problem:** The .NET services validate `ValidateIssuer = true`:

```csharp
// facility-service & identity-service Program.cs
ValidateIssuer = true,
```

But the API gateway has `ValidateIssuer = false`:

```csharp
// api-gateway Program.cs
ValidateIssuer = false, // Allow tokens issued via localhost
```

The .NET facility-service and identity-service do **not** have a `Jwt:Authority` setting injected via docker-compose environment variables. Their `appsettings.json` has no `Jwt` section at all.

**Impact:** When JWT is enabled:
- The gateway will accept tokens from any issuer (including `http://localhost:8080/realms/cinema-booking`)
- The facility-service and identity-service will reject tokens because they have no `Jwt:Authority` configured, so `ValidateIssuer=true` will fail since the issuer URI is null.
- Currently JWT is disabled on Spring Boot services (`CINEMA_SECURITY_JWT_ENABLED=false`), so this is dormant but will break on production enablement.

**Fix required:** Add `Jwt__Authority`, `Jwt__Audience`, and `Jwt__RequireHttpsMetadata` environment overrides to the `facility-service` and `identity-service` entries in `docker-compose.yml`, matching the Keycloak issuer URI pattern. Per the auth contract §6, `ValidateIssuer` **must be `true`** system-wide — see Issue #14.

---

## 14. ✅ API Gateway Violates Auth Contract: `ValidateIssuer = false`

**Status:** Resolved. Set `ValidateIssuer = true` and `Audience = "cinema-api"` in API Gateway configuration.

**Problem:** The API gateway's JWT configuration explicitly disables issuer validation:

```csharp
// api-gateway Program.cs line 57
ValidateIssuer = false, // Allow tokens issued via localhost
```

The [authentication integration contract §6](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/docs/authentication_integration_contract.md) explicitly states:

> _"Gateway and all protected services validate... exact issuer. `ValidateIssuer=false` is not acceptable outside temporary local diagnosis."_

Additionally, the gateway's `Jwt:Audience` is set to `"account"` (the Keycloak default self-service audience), not the agreed backend API audience. The contract requires a configured backend API audience.

**Impact:** Any valid Keycloak token from any realm/issuer would be accepted. This is a security vulnerability in production — tokens from other Keycloak realms or rogue issuers would pass validation.

**Fix required:**
1. Set `ValidateIssuer = true`
2. Configure the canonical Keycloak issuer URI (same one used by Spring Boot services)
3. Use the agreed backend API audience (`cinema-api`) instead of `account`
4. Solve the host/container URL difference per contract §4.3 (DNS alias or backchannel JWKS), not by disabling validation

**File:** [`Program.cs`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/api-gateway/ApiGateway/Program.cs#L54-L62)

---

## 4. ✅ API Gateway Does Not Route to Spring Boot Services

**Problem:** The YARP reverse proxy in the API gateway only defines three upstream clusters:

| Cluster                | Target                    | Routes                        |
|------------------------|---------------------------|-------------------------------|
| `keycloak-cluster`     | `http://keycloak:8080`    | `/api/auth/{**catch-all}`     |
| `user-profile-cluster` | `http://identity-service:80` | `/api/users/{**catch-all}` |
| `facility-cluster`     | `http://facility-service:80` | `/api/cinemas/{**catch-all}` |

**Missing routes for:**
- `/api/movies/**`, `/api/events/**`, `/api/genres/**`, `/api/catalog/**` → **catalog-service** (port 8081)
- `/api/showtimes/**` → **showtime-service** (port 8082)
- `/api/orders/**`, `/api/tickets/**`, `/api/vouchers/**`, `/api/reviews/**` → **booking-service** (port 8083)
- `/api/analytics/**` → **analytics-service** (port 8084)
- `/api/recommendations/**` → **recommendation-service** (port 8085)
- `/api/payments/**` → **payment-service** (port 5003, not even in compose yet)

**Impact:** The frontend cannot reach any Spring Boot service through the gateway. Direct port access (8081–8085) works for development, but in production the gateway is the single entry point.

**Fix required:** Add YARP route and cluster entries for each Spring Boot service. Include appropriate `AuthorizationPolicy` assignments matching each service's security config (e.g., catalog GET = public, catalog POST/PUT/DELETE = admin).

---

## 5. 🔴 Unresolved Git Merge Conflicts in Shared Contracts

**Problem:** The file [`facility-service.openapi.yml`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/shared/contracts/facility-service.openapi.yml) contains **multiple unresolved merge conflict markers** (`<<<<<<<`, `=======`, `>>>>>>>`). This makes the file invalid YAML and will break:
- Contract tests (`ShowtimeClientContractTest`, `BookingClientContractTest`) that parse this file
- Any OpenAPI tooling or documentation generation

**Fix required:** Resolve all merge conflicts in this file. The Spring Boot branch's internal endpoints (`/internal/facility/rooms/{roomId}`, etc.) should be kept, and the .NET branch's public API schemas should also be preserved. Merge both contributions into a single valid document.

---

## 6. ✅ RabbitMQ Configuration Key Naming Inconsistency (.NET Services)

**Problem:** The two .NET services that connect to RabbitMQ use different config key names:

| Service           | Host Key           | Username Key        | Password Key       |
|-------------------|--------------------|---------------------|--------------------|
| identity-service  | `RabbitMQ:HostName`| `RabbitMQ:UserName` | `RabbitMQ:Password`|
| payment-service   | `RabbitMQ:Host`    | `RabbitMQ:Username` | `RabbitMQ:Password`|

The `docker-compose.yml` injects environment variables for `identity-service` as:
```yaml
RabbitMQ__HostName=...
RabbitMQ__UserName=...
RabbitMQ__Password=...
```

But **payment-service is not in docker-compose** at all, so when it is added, the env var names must match `RabbitMQ__Host`, `RabbitMQ__Username`, `RabbitMQ__Password`.

**Fix required:** Standardize the config key naming across all .NET services. Either all use `HostName`/`UserName` or all use `Host`/`Username`, and update docker-compose accordingly.

---

## 7. ✅ `.env.example` Drift from `docker-compose.yml`

**Problem:** Several mismatches between `.env.example` and what `docker-compose.yml` actually consumes:

| Variable in `.env.example` | Variable in `docker-compose.yml` | Issue |
|---------------------------|----------------------------------|-------|
| `RABBITMQ_DEFAULT_USER=guest` | `RABBITMQ_DEFAULT_USER:-cinema` | `.env.example` says `guest`, compose default is `cinema` |
| `RABBITMQ_DEFAULT_PASS=guest` | `RABBITMQ_PASSWORD:-cinema-rabbitmq-dev` | `.env.example` uses different var name (`_PASS` vs `_PASSWORD`) and value (`guest` vs `cinema-rabbitmq-dev`) |
| No `NOTIFICATION_DB_NAME` | n/a | Missing from init SQL and `.env.example` |
| No `PAYMENT_SERVICE_PORT` | payment-service not in compose | Will be needed when added |

**Impact:** If someone copies `.env.example` to `.env` and starts docker-compose, the RabbitMQ container password will be `guest` (from `.env`), but all services default to `cinema-rabbitmq-dev` in their compose fallbacks, causing auth failures. The Keycloak SPI also defaults to `guest`, compounding the issue.

**Fix required:** Align `.env.example` with docker-compose defaults. Use `RABBITMQ_PASSWORD` consistently (not `RABBITMQ_DEFAULT_PASS`).

---

## 8. ✅ Payment Service Registered (Notification Service Pending)

**Status:** Partially Resolved. Added `payment-service` entry to `docker-compose.yml`. `notification-service` is acknowledged as a future TODO.

**Problem:**
- **payment-service** (.NET) has a Dockerfile, controllers, MassTransit saga integration, but **no entry in `docker-compose.yml`**. It cannot be reached by other services or the gateway.
- **notification-service** has only a `refactor_plan.md` and a `temp` file — it is a **stub with no implementation**. No Dockerfile, no code.

**Impact:**
- The booking flow's payment saga (`booking.events` → `payment.events` exchange) has no consumer running, so payments cannot be processed.
- No notifications (email, SMS) will be sent for any events.

**Fix required:**
1. Add a `payment-service` entry to `docker-compose.yml` with the correct database, RabbitMQ, and port configuration.
2. Acknowledge notification-service as a future TODO — it has no code to deploy.

---

## 9. ✅ Facility → Showtime Guard Uses Fake Data

**Problem:** The .NET facility-service's `ShowtimeServiceClient.cs` has its HTTP call to the showtime service **commented out** and replaced with a hardcoded `return false`:

```csharp
// FAKE DATA FOR TESTING
return await Task.FromResult(false);
```

This client is supposed to check if a room has future showtimes before allowing deletion/maintenance changes.

**Impact:** Rooms can be deleted or put under maintenance even if they have active future showtimes, because the guard always returns `false`.

**Fix required:** Implement the actual HTTP call to `showtime-service`. The showtime-service endpoint to check is `GET /internal/showtimes/check-active?roomIds=...` (verify this endpoint exists in showtime-service; if not, it must be created).

**File:** [`ShowtimeServiceClient.cs`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/backend/services/facility-service/FacilityService.Infrastructure/HttpClients/ShowtimeServiceClient.cs)

---

## 10. ✅ User Events Not Consumed by Any Spring Boot Service

**Problem:** The .NET identity-service publishes `user.profile.updated` events to the `user.events` exchange via MassTransit. But **no Spring Boot service subscribes** to this exchange. The events have no consumer and will be dropped.

In contrast, the Keycloak SPI publishes `user.registered` and `user.deleted` to `user.events`, and the identity-service itself consumes those. But the recommendation-service and analytics-service do not listen to any user events — they only consume `catalog.events` and `booking.events`.

**Impact:** User profile updates (display name, avatar, etc.) are published to RabbitMQ but never consumed downstream. If recommendation-service or analytics-service need user data, they currently have no way to receive it.

**Fix required:** Determine if any downstream service needs user profile events. If so, add a consumer binding. If not, document this as intentional.

---

## 11. ✅ Response Envelope Shape Mismatch on Internal Endpoints

**Problem:** The Spring Boot callers (`HttpFacilityReadService`) expect responses wrapped in `ApiResponse<T>`:

```java
ApiResponse<FacilityRoomView> response = restClient.get()
    .uri("/internal/facility/rooms/{roomId}", roomId)
    .retrieve()
    .body(new ParameterizedTypeReference<ApiResponse<FacilityRoomView>>() {});
```

Where `ApiResponse` has the shape: `{ "success": true, "code": "...", "message": "...", "data": { ... } }`

The **existing** .NET internal endpoint (`GET /internal/rooms/{roomId}/seats`) returns the data directly **without** the `ApiResponse` wrapper:

```csharp
return Ok(result); // No ApiResponse wrapper
```

Whereas the public .NET endpoints do use the wrapper:

```csharp
return Ok(ApiResponse<IEnumerable<SeatTemplateDto>>.Ok(result));
```

**Impact:** Even if the endpoint paths are fixed (Issue #1), the response deserialization will fail if the new internal endpoints don't wrap in the `ApiResponse` envelope.

**Fix required:** All new internal endpoints on the .NET facility-service must wrap responses using the same `ApiResponse<T>` model that the Spring Boot callers expect. A C# model already exists at `FacilityService.Presentation.Models.ApiResponse<T>`.

---

## 12. ✅ Health Check Path Difference

**Problem:** 
- .NET services expose health at `/health`
- Spring Boot services expose health at `/actuator/health`
- The API gateway's `AggregateHealthCheck` and YARP health checks reference `/health`

The gateway YARP cluster health check for `facility-cluster` uses `Path: "/health"` which works for .NET services. If Spring Boot services are added to gateway clusters, their health path must be `/actuator/health`.

**Impact:** Minor — only affects gateway health aggregation for future Spring Boot cluster entries.

---

## 13. ✅ Java Facility Service Residual Code and DB Name

**Problem:** The `facility-service/` directory contains **both** a .NET Clean Architecture project (`FacilityService.Application`, `FacilityService.Domain`, etc.) and a **residual Spring Boot project** (`src/`, `pom.xml`). The Dockerfile builds the .NET project, so the Java code is unused but still present.

The Java `application.yml` references `cinema_facility_db` while the .NET service uses `facility_db`:

| Source               | Database Name         |
|----------------------|-----------------------|
| Java `application.yml` | `cinema_facility_db` |
| .NET `appsettings.json` | `facility_db`       |
| `init-multiple-databases.sql` | `facility_db` |
| `docker-compose.yml` | `facility_db`         |

**Impact:** The Java code is dead but may cause confusion. The DB name is consistent in the live (.NET) path.

**Fix required:** Consider removing the Java `src/` and `pom.xml` from the facility-service directory to reduce confusion.

---

## Action Priority

### Must Fix Before Integration Testing

| # | Issue | Effort |
|---|-------|--------|
| 1 | Add missing `/internal/facility/*` endpoints to .NET facility-service | Medium |
| 4 | Add Spring Boot service routes to API gateway YARP config | Medium |
| 5 | Resolve merge conflicts in `facility-service.openapi.yml` | Low |
| 11 | Use `ApiResponse<T>` wrapper on new internal endpoints | Low |
| 8 | Add payment-service to `docker-compose.yml` | Low |
| 14 | Fix `ValidateIssuer=false` and `Audience="account"` in gateway | Low |

### Should Fix Before Staging

| # | Issue | Effort |
|---|-------|--------|
| 2 | Implement `X-Internal-Token` validation on .NET services (or document trust model) | Medium |
| 3 | Add JWT env vars for .NET services in docker-compose | Low |
| 7 | Fix `.env.example` to match docker-compose defaults | Low |
| 6 | Standardize RabbitMQ config keys across .NET services | Low |
| 9 | Implement real showtime guard HTTP call | Low |

### Can Defer

| # | Issue | Effort |
|---|-------|--------|
| 10 | User events consumer for downstream services | Low |
| 12 | Health check path alignment | Low |
| 13 | Remove dead Java code from facility-service | Low |
