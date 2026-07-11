# Identity Service (User Profile Service) — Refactor Plan

> **Framework**: ASP.NET Core 9 (C#) | **Port**: 5001 | **Database**: PostgreSQL 16 (`user_profile_db`) + Redis 7
> **Bounded Context**: User Profile (auth delegated to **Keycloak**)

> [!IMPORTANT]
> **Keycloak Delegation**: All authentication responsibilities (login, registration, JWT issuance, refresh tokens, password reset, JWKS) are handled by **Keycloak**. This service manages extended user profile data, maps Keycloak UUIDs to internal Long IDs, and publishes domain events. It does NOT store passwords, issue tokens, or manage sessions.

---

## 1. Responsibility

Extended user profile management (profile fields, preferences), Keycloak user ID ↔ internal Long ID mapping, internal user lookup APIs for other services, and consuming Keycloak events to create/sync local user records.

**NOT in scope** (handled by Keycloak):
- User registration / login / logout
- JWT issuance / validation / refresh
- Password hashing / reset / change
- Role management (ADMIN, STAFF, CUSTOMER)
- JWKS endpoint
- Token blacklist / revocation
- Session management

---

## 2. Architecture Pattern

**Clean Architecture** (4-layer) — consistent with the existing Facility Service pattern.

```
IdentityService.Presentation  →  IdentityService.Application  →  IdentityService.Domain
                                        ↓
                              IdentityService.Infrastructure
```

---

## 3. NuGet Libraries

### Domain Layer (`IdentityService.Domain`)
| Package | Version | Purpose |
|---|---|---|
| *(no external packages)* | — | Pure domain, zero dependencies |

### Application Layer (`IdentityService.Application`)
| Package | Version | Purpose |
|---|---|---|
| `MediatR` | 12.4.1 | CQRS — command/query dispatching |
| `FluentValidation` | 11.11.0 | Input validation for commands |
| `FluentValidation.DependencyInjectionExtensions` | 11.11.0 | Auto-register validators |

### Infrastructure Layer (`IdentityService.Infrastructure`)
| Package | Version | Purpose |
|---|---|---|
| `Microsoft.EntityFrameworkCore` | 9.0.0 | ORM |
| `Npgsql.EntityFrameworkCore.PostgreSQL` | 9.0.0 | PostgreSQL provider |
| `Microsoft.EntityFrameworkCore.Design` | 9.0.0 | EF migrations |
| `Microsoft.EntityFrameworkCore.Tools` | 9.0.0 | CLI tools |
| `RabbitMQ.Client` | 7.2.1 | RabbitMQ messaging (publish user events, consume Keycloak events) |
| `Microsoft.Extensions.Caching.StackExchangeRedis` | 9.0.0 | Redis cache (user profile cache) |
| `StackExchange.Redis` | 2.8.0 | Redis connection |
| `Microsoft.AspNetCore.Authentication.JwtBearer` | 9.0.0 | JWT bearer middleware (validates Keycloak-issued tokens) |

> **Removed** (vs. original plan): `Microsoft.IdentityModel.Tokens`, `System.IdentityModel.Tokens.Jwt`, `BCrypt.Net-Next` — no longer needed since Keycloak handles auth/JWT/passwords.

### Presentation Layer (`IdentityService.Presentation`)
| Package | Version | Purpose |
|---|---|---|
| `Swashbuckle.AspNetCore` | 10.2.3 | Swagger/OpenAPI UI |

---

## 4. Domain Entities

### `User`
| Property | Type | Notes |
|---|---|---|
| `Id` | `long` | PK, auto-increment (internal ID used by all services) |
| `KeycloakId` | `string` | **Unique**, Keycloak user UUID (`sub` claim). Indexed |
| `Email` | `string` | Unique, synced from Keycloak |
| `FullName` | `string` | Synced from Keycloak on first registration |
| `Phone` | `string?` | Extended profile field |
| `Gender` | `Gender` (enum) | MALE, FEMALE, OTHER |
| `DateOfBirth` | `DateTime?` | Extended profile field |
| `Active` | `bool` | Default true, synced with Keycloak `enabled` flag |
| `CreatedAt` | `DateTime` | UTC |
| `UpdatedAt` | `DateTime?` | UTC |

> **Removed** (vs. original plan): `PasswordHash`, `Roles` navigation, `RefreshTokens` navigation. These are managed by Keycloak.
> **Removed entities**: `Role`, `UserRole`, `RefreshToken`, `PasswordResetToken` — all managed by Keycloak.

### Enums
- `Gender`: `MALE`, `FEMALE`, `OTHER`

---

## 5. CQRS — Features (Commands & Queries)

### User Profile
| Type | Name | Description |
|---|---|---|
| Query | `GetCurrentUserQuery` | Get authenticated user profile (by Keycloak ID from JWT `sub`) |
| Query | `GetUserByIdQuery` | Admin: get any user |
| Query | `GetUsersQuery` | Admin: paginated user list |
| Command | `UpdateUserProfileCommand` | Update own profile (phone, gender, dateOfBirth) |

### Keycloak Sync
| Type | Name | Description |
|---|---|---|
| Command | `CreateUserFromKeycloakEventCommand` | Consume `user.registered` event from Keycloak → create local user record with `keycloakId` mapping |
| Command | `SyncUserFromKeycloakCommand` | Sync user data from Keycloak (e.g., email change, enabled status) |

### Internal API
| Type | Name | Description |
|---|---|---|
| Query | `GetUserCountQuery` | Internal: total user count for Analytics |
| Query | `GetUserByIdInternalQuery` | Internal: user info for other services |
| Query | `ResolveKeycloakIdQuery` | Internal: resolve Keycloak UUID → internal Long ID (Gateway uses this) |

> **Removed** (vs. original plan): All Auth commands (`RegisterCommand`, `LoginCommand`, `RefreshTokenCommand`, `LogoutCommand`, `RequestPasswordResetCommand`, `ResetPasswordCommand`, `ChangePasswordCommand`). All Role commands/queries (`GetRolesQuery`, `AssignRoleCommand`, `RemoveRoleCommand`). These go to Keycloak directly.

---

## 6. Integration Events (RabbitMQ)

### Published Events
| Exchange | Routing Key | Payload Class | Triggered By |
|---|---|---|---|
| `user.events` | `user.profile.updated` | `UserProfileUpdatedPayload` | `UpdateUserProfileCommand` |

### Consumed Events
| Exchange | Routing Key | Payload Class | Handler |
|---|---|---|---|
| `user.events` | `user.registered` | `KeycloakUserRegisteredPayload` | `CreateUserFromKeycloakEventCommand` — creates local user record |

> **Note**: The `user.registered` event is published by the **Keycloak Event Listener SPI** (a custom Keycloak extension), NOT by this service. This service only consumes it.
> **Note**: `user.password.reset` events are also published by the Keycloak SPI and consumed by the **Notification Service** — this service does not need to handle them.

### Event Payloads (Records)

```csharp
// Published by this service
public record UserProfileUpdatedPayload(long UserId, string Email, string FullName);

// Consumed from Keycloak SPI
public record KeycloakUserRegisteredPayload(string KeycloakId, string Email, string FullName);
```

---

## 7. API Endpoints

### User Profile (Public)
| Method | Route | Auth | Handler |
|---|---|---|---|
| `GET` | `/api/users/me` | ✓ | `GetCurrentUserQuery` |
| `PUT` | `/api/users/me` | ✓ | `UpdateUserProfileCommand` |
| `GET` | `/api/users` | ✓ (ADMIN) | `GetUsersQuery` |
| `GET` | `/api/users/{id}` | ✓ (ADMIN) | `GetUserByIdQuery` |

### Internal (blocked at Gateway)
| Method | Route | Auth | Handler |
|---|---|---|---|
| `GET` | `/internal/users/count` | API Key | `GetUserCountQuery` |
| `GET` | `/internal/users/{id}` | API Key | `GetUserByIdInternalQuery` |
| `GET` | `/internal/users/resolve` | API Key | `ResolveKeycloakIdQuery` — `?keycloakId={uuid}` → returns `{ id: Long }` |

### Health
| Method | Route | Purpose |
|---|---|---|
| `GET` | `/health` | Health check |

> **Removed** (vs. original plan): All `/api/auth/*` endpoints, all `/api/roles/*` endpoints, `/.well-known/jwks.json` endpoint. These are handled by Keycloak.

---

## 8. Redis Usage

| Key Pattern | Purpose | TTL |
|---|---|---|
| `user:profile:{keycloakId}` | Cache user profile for fast lookup | 5 min |
| `user:resolve:{keycloakId}` | Cache Keycloak UUID → internal Long ID mapping | 30 min |
| `rate:profile:update:{userId}` | Rate limit profile updates | 1 min |

> **Removed** (vs. original plan): `token:blacklist:{jti}` — Keycloak handles token revocation. `rate:login:{ip}` — Keycloak handles brute force protection. `password:reset:{userId}` — Keycloak handles password resets.

---

## 9. Folder Structure

```
identity-service/
├── IdentityService.slnx
│
├── IdentityService.Domain/
│   ├── IdentityService.Domain.csproj
│   ├── Entities/
│   │   └── User.cs
│   ├── Enums/
│   │   └── Gender.cs
│   └── Interfaces/
│       ├── IUserRepository.cs
│       └── IUnitOfWork.cs
│
├── IdentityService.Application/
│   ├── IdentityService.Application.csproj
│   ├── DependencyInjection.cs
│   ├── Behaviors/
│   │   └── ValidationBehavior.cs
│   ├── Contracts/
│   │   └── IEventPublisher.cs
│   ├── DTOs/
│   │   ├── UserDto.cs
│   │   └── PagedResult.cs
│   ├── Messages/
│   │   └── UserProfileIntegrationEvents.cs
│   ├── Exceptions/
│   │   ├── UserNotFoundException.cs
│   │   └── DuplicateEmailException.cs
│   └── Features/
│       ├── Users/
│       │   ├── Commands/
│       │   │   └── UpdateUserProfileCommand.cs
│       │   └── Queries/
│       │       ├── GetCurrentUserQuery.cs
│       │       ├── GetUserByIdQuery.cs
│       │       └── GetUsersQuery.cs
│       ├── KeycloakSync/
│       │   └── Commands/
│       │       ├── CreateUserFromKeycloakEventCommand.cs
│       │       └── SyncUserFromKeycloakCommand.cs
│       └── Internal/
│           └── Queries/
│               ├── GetUserCountQuery.cs
│               ├── GetUserByIdInternalQuery.cs
│               └── ResolveKeycloakIdQuery.cs
│
├── IdentityService.Infrastructure/
│   ├── IdentityService.Infrastructure.csproj
│   ├── DependencyInjection.cs
│   ├── DatabaseMigration.cs
│   ├── Data/
│   │   ├── UserProfileDbContext.cs
│   │   └── Configurations/
│   │       └── UserConfiguration.cs
│   ├── Repositories/
│   │   ├── UserRepository.cs
│   │   └── UnitOfWork.cs
│   └── Messaging/
│       ├── RabbitMqEventPublisher.cs
│       └── KeycloakEventConsumer.cs
│
├── IdentityService.Presentation/
│   ├── IdentityService.Presentation.csproj
│   ├── Program.cs
│   ├── appsettings.json
│   ├── appsettings.Development.json
│   ├── Properties/
│   │   └── launchSettings.json
│   ├── Controllers/
│   │   ├── UsersController.cs
│   │   └── InternalUsersController.cs
│   └── Middleware/
│       └── ExceptionHandlingMiddleware.cs
│
├── IdentityService.Test/
│   ├── IdentityService.Test.csproj
│   ├── Unit/
│   │   ├── Entities/
│   │   │   └── UserTests.cs
│   │   └── Features/
│   │       ├── UpdateUserProfileCommandHandlerTests.cs
│   │       └── ResolveKeycloakIdQueryHandlerTests.cs
│   └── Integration/
│       └── UsersControllerTests.cs
│
└── Dockerfile
```

> **Removed** (vs. original plan): `AuthController.cs`, `RolesController.cs`, `JwksEndpoint.cs`, `JwtService.cs`, `PasswordHasherService.cs`, `TokenBlacklistService.cs`, `RefreshToken.cs`, `PasswordResetToken.cs`, `Role.cs`, `UserRole.cs`, all auth feature command files, all role feature files, all auth-related repositories/configurations.

---

## 10. Database Schema (`user_profile_db`)

```sql
CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    keycloak_id     VARCHAR(36) NOT NULL UNIQUE,  -- Keycloak user UUID
    email           VARCHAR(255) NOT NULL UNIQUE,
    full_name       VARCHAR(150) NOT NULL,
    phone           VARCHAR(20),
    gender          VARCHAR(10),
    date_of_birth   DATE,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

CREATE INDEX idx_users_keycloak_id ON users(keycloak_id);
```

> **Removed** (vs. original plan): `password_hash` column, `roles` table, `user_roles` table, `refresh_tokens` table, `password_reset_tokens` table. All managed by Keycloak.

---

## 11. JWT Validation (Keycloak OIDC)

This service does NOT issue JWTs. It validates Keycloak-issued tokens using the standard OIDC discovery mechanism:

- **Authority**: `http://keycloak:8080/realms/cinema-booking`
- **JWKS URI**: Auto-discovered via `{authority}/.well-known/openid-configuration`
- **Audience**: `cinema-api-gateway` (or `account`)
- **Claims used**: `sub` (Keycloak UUID) → resolved to internal `Long` ID via `ResolveKeycloakIdQuery`
- **Roles**: Read from `realm_access.roles` claim (forwarded by Gateway as `X-User-Roles` header)

```csharp
// Program.cs — JWT configuration
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "http://keycloak:8080/realms/cinema-booking";
        options.Audience = "cinema-api-gateway";
        options.RequireHttpsMetadata = false; // true in production
    });
```

---

## 12. Key Design Decisions

1. **Keycloak as auth authority**: This service contains zero auth logic. Login, registration, JWT, refresh tokens, password management, and role assignment are all handled by Keycloak. This dramatically reduces the service's complexity and attack surface.
2. **Dual ID system**: `id` (Long, internal) + `keycloak_id` (UUID, external). All downstream services (Booking, Payment, Showtime) continue using `Long` user IDs via `X-User-Id` header. The Gateway resolves `sub` → `X-User-Id` via this service's `/internal/users/resolve` endpoint (cached in Redis for 30 min).
3. **Keycloak Event Listener SPI**: User registration in Keycloak triggers a `user.registered` event on RabbitMQ. This service consumes the event and creates a local user record. This ensures eventual consistency between Keycloak and the local DB without tight coupling.
4. **Validator co-location**: Each command has its validator inline (following the Facility Service pattern with `CreateCinemaCommandValidator`).
5. **Internal APIs**: Protected by `X-Internal-Api-Key` header, not JWT.
