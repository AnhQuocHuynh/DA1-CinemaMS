# API Gateway — Refactor Plan

> **Framework**: ASP.NET Core 9 (C#) + YARP | **Port**: 5000
> **Role**: Infrastructure — Reverse Proxy, Request Routing, Cross-Cutting Concerns
> **Status**: Greenfield

---

## 1. Responsibility

Central entry point for all client requests. Handles request routing to upstream microservices, JWT validation, rate limiting, circuit breaking, CORS, and request/response logging.

---

## 2. Architecture

The API Gateway is **NOT** a Clean Architecture service. It is a thin infrastructure layer — no domain logic, no database.

```
ApiGateway (single project)
├── YARP Reverse Proxy Configuration
├── JWT Validation Middleware
├── Rate Limiting Middleware (Redis-backed)
├── Circuit Breaker (Polly)
├── CORS Configuration
├── Request Logging
└── Health Checks
```

---

## 3. NuGet Libraries

| Package | Version | Purpose |
|---|---|---|
| `Yarp.ReverseProxy` | 2.1.0 | YARP — high-performance reverse proxy |
| `Microsoft.AspNetCore.Authentication.JwtBearer` | 9.0.0 | JWT validation (RS256, OIDC discovery from **Keycloak**) |
| `Microsoft.AspNetCore.RateLimiting` | — | Built-in rate limiting (ASP.NET 9) |
| `Microsoft.Extensions.Caching.StackExchangeRedis` | 9.0.0 | Redis-backed rate limit counters + response cache |
| `Polly` | 8.4.0 | Resilience: circuit breaker, retry, timeout |
| `Polly.Extensions.Http` | 3.0.0 | Polly extensions for HttpClient |
| `Microsoft.Extensions.Http.Polly` | 9.0.0 | Polly integration with HttpClientFactory |
| `Swashbuckle.AspNetCore` | 10.2.3 | Swagger UI (aggregate upstream docs) |
| `AspNetCore.HealthChecks.Redis` | 8.0.0 | Redis health check |
| `AspNetCore.HealthChecks.Rabbitmq` | 8.0.0 | RabbitMQ health check |
| `AspNetCore.HealthChecks.NpgSql` | 8.0.0 | PostgreSQL health check |
| `Serilog.AspNetCore` | 9.0.0 | Structured logging |
| `Serilog.Sinks.Console` | 6.0.0 | Console log output |

---

## 4. YARP Route Configuration

### Service Clusters

| Cluster ID | Upstream Address | Health Check |
|---|---|---|
| `keycloak-cluster` | `http://keycloak:8080` | `/health` |
| `user-profile-cluster` | `http://user-profile-service:5001` | `/health` |
| `catalog-cluster` | `http://catalog-service:8081` | `/actuator/health` |
| `facility-cluster` | `http://facility-service:5002` | `/health` |
| `showtime-cluster` | `http://showtime-service:8082` | `/actuator/health` |
| `booking-cluster` | `http://booking-service:8083` | `/actuator/health` |
| `payment-cluster` | `http://payment-service:5003` | `/health` |
| `analytics-cluster` | `http://analytics-service:8084` | `/actuator/health` |
| `recommendation-cluster` | `http://recommendation-service:8085` | `/actuator/health` |

### Route Table

| Route ID | Match Pattern | Cluster | Auth Policy | Rate Limit |
|---|---|---|---|---|
| `auth-route` | `/api/auth/{**catch-all}` | `keycloak-cluster` | None | 20/min |
| `users-route` | `/api/users/{**catch-all}` | `user-profile-cluster` | `authenticated` | 60/min |
| `movies-read` | `/api/movies/{**catch-all}` (GET) | `catalog-cluster` | None | 120/min |
| `movies-write` | `/api/movies/{**catch-all}` (POST/PUT/DELETE) | `catalog-cluster` | `admin` | 30/min |
| `events-read` | `/api/events/{**catch-all}` (GET) | `catalog-cluster` | None | 120/min |
| `events-write` | `/api/events/{**catch-all}` (POST/PUT/DELETE) | `catalog-cluster` | `admin` | 30/min |
| `genres-route` | `/api/genres/{**catch-all}` | `catalog-cluster` | Mixed | 60/min |
| `cinemas-read` | `/api/cinemas/{**catch-all}` (GET) | `facility-cluster` | None | 120/min |
| `cinemas-write` | `/api/cinemas/{**catch-all}` (POST/PUT/DELETE) | `facility-cluster` | `admin` | 30/min |
| `showtimes-read` | `/api/showtimes/{**catch-all}` (GET) | `showtime-cluster` | None | 200/min |
| `showtimes-write` | `/api/showtimes/{**catch-all}` (POST/DELETE) | `showtime-cluster` | `admin-or-staff` | 30/min |
| `seat-hold` | `/api/showtimes/*/hold` | `showtime-cluster` | `authenticated` | 60/min |
| `orders-route` | `/api/orders/{**catch-all}` | `booking-cluster` | `authenticated` | 30/min |
| `tickets-route` | `/api/tickets/{**catch-all}` | `booking-cluster` | `authenticated` | 60/min |
| `vouchers-route` | `/api/vouchers/{**catch-all}` | `booking-cluster` | Mixed | 60/min |
| `reviews-route` | `/api/reviews/{**catch-all}` | `booking-cluster` | Mixed | 30/min |
| `payments-route` | `/api/payments/{**catch-all}` | `payment-cluster` | `authenticated` | 20/min |
| `dashboard-route` | `/api/admin/dashboard/{**catch-all}` | `analytics-cluster` | `admin` | 30/min |
| `staff-route` | `/api/staff/{**catch-all}` | `booking-cluster` | `staff` | 60/min |
| `rec-personal` | `/api/recommendations/movies` (GET) | `recommendation-cluster` | `authenticated` | 60/min |
| `rec-popular` | `/api/recommendations/movies/popular` (GET) | `recommendation-cluster` | None | 120/min |
| `rec-similar` | `/api/recommendations/movies/*/similar` (GET) | `recommendation-cluster` | None | 60/min |

### Internal Route Blocking

All `/internal/**` routes are **blocked at the gateway** — they should never be exposed externally:

```json
{
  "Routes": {
    "block-internal": {
      "ClusterId": null,
      "Match": { "Path": "/internal/{**catch-all}" },
      "Transforms": [],
      "Metadata": { "blocked": "true" }
    }
  }
}
```

---

## 5. JWT Validation (Keycloak OIDC)

- **Algorithm**: RS256 (asymmetric, Keycloak-issued)
- **OIDC Discovery**: `http://keycloak:8080/realms/cinema-booking/.well-known/openid-configuration`
- **JWKS endpoint**: Auto-discovered via OIDC → `http://keycloak:8080/realms/cinema-booking/protocol/openid-connect/certs`
- **Validated claims**: `sub` (UUID), `email`, `realm_access.roles[]`, `exp`
- **Header forwarding**: After validation, Gateway resolves Keycloak UUID → internal Long ID and adds headers to upstream:
  - `X-User-Id`: resolved internal Long ID (via cached call to User Profile Service `/internal/users/resolve?keycloakId={sub}`)
  - `X-Keycloak-Id`: from `sub` claim (UUID)
  - `X-User-Email`: from `email` claim
  - `X-User-Roles`: comma-separated roles from `realm_access.roles` claim

> **Note**: Keycloak uses `realm_access.roles` for realm-level roles (e.g., `ADMIN`, `STAFF`, `CUSTOMER`). The Gateway maps these to the `X-User-Roles` header.

### Authorization Policies

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("authenticated", policy => policy.RequireAuthenticatedUser());
    options.AddPolicy("admin", policy => policy.RequireRole("ADMIN"));
    options.AddPolicy("staff", policy => policy.RequireRole("STAFF"));
    options.AddPolicy("admin-or-staff", policy => policy.RequireRole("ADMIN", "STAFF"));
});
```

> **Keycloak role mapping**: To make `RequireRole("ADMIN")` work with Keycloak's JWT, configure the JWT bearer to map `realm_access.roles` to ClaimTypes.Role. See `Program.cs` skeleton in Section 10.

---

## 6. Rate Limiting Strategy

Using ASP.NET 9 built-in `Microsoft.AspNetCore.RateLimiting` with Redis-backed storage:

| Policy | Window | Limit | Key |
|---|---|---|---|
| `low` | 1 min | 20 | IP + route |
| `standard` | 1 min | 60 | IP + route |
| `high` | 1 min | 120 | IP + route |
| `hot` | 1 min | 200 | IP + route |

---

## 7. Circuit Breaker (Polly)

Applied per upstream cluster:

| Setting | Value |
|---|---|
| Failure threshold | 5 consecutive failures |
| Break duration | 30 seconds |
| Timeout per request | 10 seconds |
| Retry | 2 retries with exponential backoff |

---

## 8. Folder Structure

```
api-gateway/
├── ApiGateway.slnx
│
├── ApiGateway/
│   ├── ApiGateway.csproj
│   ├── Program.cs
│   ├── appsettings.json
│   ├── appsettings.Development.json
│   ├── Properties/
│   │   └── launchSettings.json
│   ├── Configuration/
│   │   ├── YarpConfig.cs
│   │   ├── AuthPolicies.cs
│   │   ├── RateLimitPolicies.cs
│   │   ├── CorsConfig.cs
│   │   └── PollyPolicies.cs
│   ├── Middleware/
│   │   ├── JwtClaimsForwardingMiddleware.cs
│   │   ├── InternalRouteBlockingMiddleware.cs
│   │   ├── RequestLoggingMiddleware.cs
│   │   └── CorrelationIdMiddleware.cs
│   ├── HealthChecks/
│   │   └── AggregateHealthCheck.cs
│   └── Transforms/
│       └── UserHeadersTransformProvider.cs
│
└── Dockerfile
```

---

## 9. `appsettings.json` Structure

```json
{
  "ReverseProxy": {
    "Routes": {
      "auth-route": {
        "ClusterId": "keycloak-cluster",
        "Match": { "Path": "/api/auth/{**catch-all}" }
      },
      "users-route": {
        "ClusterId": "user-profile-cluster",
        "Match": { "Path": "/api/users/{**catch-all}" },
        "AuthorizationPolicy": "authenticated"
      },
      "movies-route": {
        "ClusterId": "catalog-cluster",
        "Match": { "Path": "/api/movies/{**catch-all}" }
      },
      "cinemas-route": {
        "ClusterId": "facility-cluster",
        "Match": { "Path": "/api/cinemas/{**catch-all}" }
      },
      "showtimes-route": {
        "ClusterId": "showtime-cluster",
        "Match": { "Path": "/api/showtimes/{**catch-all}" }
      },
      "orders-route": {
        "ClusterId": "booking-cluster",
        "Match": { "Path": "/api/orders/{**catch-all}" },
        "AuthorizationPolicy": "authenticated"
      },
      "payments-route": {
        "ClusterId": "payment-cluster",
        "Match": { "Path": "/api/payments/{**catch-all}" },
        "AuthorizationPolicy": "authenticated"
      },
      "dashboard-route": {
        "ClusterId": "analytics-cluster",
        "Match": { "Path": "/api/admin/dashboard/{**catch-all}" },
        "AuthorizationPolicy": "admin"
      },
      "rec-route": {
        "ClusterId": "recommendation-cluster",
        "Match": { "Path": "/api/recommendations/{**catch-all}" }
      }
    },
    "Clusters": {
      "keycloak-cluster": {
        "Destinations": {
          "keycloak-1": { "Address": "http://keycloak:8080" }
        },
        "HealthCheck": {
          "Active": { "Enabled": true, "Interval": "00:00:30", "Path": "/health" }
        }
      },
      "user-profile-cluster": {
        "Destinations": {
          "user-profile-1": { "Address": "http://user-profile-service:5001" }
        },
        "HealthCheck": {
          "Active": { "Enabled": true, "Interval": "00:00:10", "Path": "/health" }
        }
      },
      "catalog-cluster": {
        "Destinations": {
          "catalog-1": { "Address": "http://catalog-service:8081" }
        },
        "HealthCheck": {
          "Active": { "Enabled": true, "Interval": "00:00:10", "Path": "/actuator/health" }
        }
      },
      "facility-cluster": {
        "Destinations": {
          "facility-1": { "Address": "http://facility-service:5002" }
        },
        "HealthCheck": {
          "Active": { "Enabled": true, "Interval": "00:00:10", "Path": "/health" }
        }
      },
      "showtime-cluster": {
        "Destinations": {
          "showtime-1": { "Address": "http://showtime-service:8082" }
        },
        "HealthCheck": {
          "Active": { "Enabled": true, "Interval": "00:00:10", "Path": "/actuator/health" }
        }
      },
      "booking-cluster": {
        "Destinations": {
          "booking-1": { "Address": "http://booking-service:8083" }
        },
        "HealthCheck": {
          "Active": { "Enabled": true, "Interval": "00:00:10", "Path": "/actuator/health" }
        }
      },
      "payment-cluster": {
        "Destinations": {
          "payment-1": { "Address": "http://payment-service:5003" }
        },
        "HealthCheck": {
          "Active": { "Enabled": true, "Interval": "00:00:10", "Path": "/health" }
        }
      },
      "analytics-cluster": {
        "Destinations": {
          "analytics-1": { "Address": "http://analytics-service:8084" }
        },
        "HealthCheck": {
          "Active": { "Enabled": true, "Interval": "00:00:10", "Path": "/actuator/health" }
        }
      },
      "recommendation-cluster": {
        "Destinations": {
          "recommendation-1": { "Address": "http://recommendation-service:8085" }
        },
        "HealthCheck": {
          "Active": { "Enabled": true, "Interval": "00:00:10", "Path": "/actuator/health" }
        }
      }
    }
  },
  "Jwt": {
    "Authority": "http://keycloak:8080/realms/cinema-booking",
    "Audience": "cinema-api-gateway",
    "RequireHttpsMetadata": false
  },
  "UserProfileService": {
    "BaseUrl": "http://user-profile-service:5001",
    "ResolveEndpoint": "/internal/users/resolve"
  },
  "Redis": {
    "ConnectionString": "redis:6379"
  },
  "Cors": {
    "AllowedOrigins": ["http://localhost:3000", "http://localhost:5173"]
  }
}
```

---

## 10. `Program.cs` Skeleton

```csharp
var builder = WebApplication.CreateBuilder(args);

// YARP
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

// JWT Authentication (Keycloak OIDC)
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = builder.Configuration["Jwt:Authority"];
        // e.g., "http://keycloak:8080/realms/cinema-booking"
        options.Audience = builder.Configuration["Jwt:Audience"];
        options.RequireHttpsMetadata = false; // true in production
        
        // Map Keycloak's realm_access.roles to ClaimTypes.Role
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            NameClaimType = "preferred_username",
            RoleClaimType = "realm_access.roles"
        };
        
        // Custom event to extract Keycloak realm roles from nested JSON
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                // Extract realm_access.roles from Keycloak JWT
                // and add them as standard role claims
                var realmAccess = context.Principal?.FindFirst("realm_access");
                if (realmAccess != null)
                {
                    var parsed = JsonDocument.Parse(realmAccess.Value);
                    if (parsed.RootElement.TryGetProperty("roles", out var roles))
                    {
                        var identity = context.Principal?.Identity as ClaimsIdentity;
                        foreach (var role in roles.EnumerateArray())
                        {
                            identity?.AddClaim(new Claim(ClaimTypes.Role, role.GetString()!));
                        }
                    }
                }
                return Task.CompletedTask;
            }
        };
    });

// Authorization Policies
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("authenticated", p => p.RequireAuthenticatedUser());
    options.AddPolicy("admin", p => p.RequireRole("ADMIN"));
    options.AddPolicy("staff", p => p.RequireRole("STAFF"));
    options.AddPolicy("admin-or-staff", p => p.RequireRole("ADMIN", "STAFF"));
});

// Rate Limiting
builder.Services.AddRateLimiter(options => { /* configure policies */ });

// Redis
builder.Services.AddStackExchangeRedisCache(options =>
    options.Configuration = builder.Configuration["Redis:ConnectionString"]);

// CORS
builder.Services.AddCors();

// Health Checks
builder.Services.AddHealthChecks()
    .AddRedis(builder.Configuration["Redis:ConnectionString"]!)
    .AddCheck<AggregateHealthCheck>("upstream-services");

var app = builder.Build();

app.UseCors(policy => policy
    .WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()!)
    .AllowAnyMethod()
    .AllowAnyHeader()
    .AllowCredentials());

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<RequestLoggingMiddleware>();
app.UseMiddleware<InternalRouteBlockingMiddleware>();
app.UseMiddleware<KeycloakUserIdResolutionMiddleware>(); // Resolves sub (UUID) → X-User-Id (Long)

app.MapReverseProxy();
app.MapHealthChecks("/health");

app.Run();
```

---

## 11. Key Design Decisions

1. **YARP over Ocelot**: YARP is Microsoft's official, high-performance reverse proxy with native ASP.NET integration. Better performance and active development compared to Ocelot.
2. **Keycloak as token authority**: JWT validation uses Keycloak's OIDC discovery endpoint — no need for custom JWKS endpoint management. The Gateway auto-discovers signing keys via `{authority}/.well-known/openid-configuration`.
3. **Keycloak UUID → internal Long ID resolution**: A `KeycloakUserIdResolutionMiddleware` resolves the JWT `sub` claim (Keycloak UUID) to the internal `Long` user ID via a cached call to the User Profile Service. This ensures backward compatibility with all downstream services that use `Long` user IDs.
4. **Single project**: Gateway is intentionally NOT Clean Architecture — it's a thin proxy with zero domain logic.
5. **Redis-backed rate limiting**: Ensures rate limit counts are shared across Gateway replicas in production.
6. **Correlation ID propagation**: `CorrelationIdMiddleware` generates or forwards `X-Correlation-Id` header for distributed tracing.
7. **Internal route blocking**: All `/internal/**` requests are rejected with 403 at the Gateway level to prevent external access.
8. **JWT claims forwarding**: After validating JWT and resolving user ID, the Gateway passes `X-User-Id` (Long), `X-Keycloak-Id` (UUID), `X-User-Email`, and `X-User-Roles` headers to upstream services, so they don't need to re-validate the token.
9. **Health check aggregation**: Gateway checks all upstream services (including Keycloak) and reports aggregate health status.
