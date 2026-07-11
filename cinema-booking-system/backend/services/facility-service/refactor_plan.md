# Facility Service — Refactor Plan

> **Framework**: ASP.NET Core 9 (C#) | **Port**: 5002 | **Database**: PostgreSQL 16 (`facility_db`)
> **Bounded Context**: Facility (Cinema, Room, Seat infrastructure)
> **Status**: Partially implemented — Clean Architecture skeleton exists

---

## 1. Responsibility

Cinema management, Room management, Seat template & seat type configuration. Exposes internal API for Showtime Service to fetch room/seat data.

---

## 2. Architecture Pattern

**Clean Architecture** (4-layer) — already established:

```
FacilityService.Presentation  →  FacilityService.Application  →  FacilityService.Domain
                                        ↓
                              FacilityService.Infrastructure
```

---

## 3. NuGet Libraries

### Domain Layer (`FacilityService.Domain`)
| Package | Version | Purpose |
|---|---|---|
| *(no external packages)* | — | Pure domain, zero dependencies |

### Application Layer (`FacilityService.Application`)
| Package | Version | Purpose |
|---|---|---|
| `MediatR` | 12.4.1 | ✅ Already installed — CQRS dispatching |
| `FluentValidation` | 11.11.0 | ✅ Already installed — input validation |
| `FluentValidation.DependencyInjectionExtensions` | 11.11.0 | ✅ Already installed — auto-register validators |

### Infrastructure Layer (`FacilityService.Infrastructure`)
| Package | Version | Purpose |
|---|---|---|
| `Microsoft.EntityFrameworkCore` | 9.0.0 | ✅ Already installed — ORM |
| `Npgsql.EntityFrameworkCore.PostgreSQL` | 9.0.0 | ✅ Already installed — PostgreSQL provider |
| `Microsoft.EntityFrameworkCore.Design` | 9.0.0 | ✅ Already installed — EF migrations |
| `Microsoft.EntityFrameworkCore.Tools` | 9.0.0 | ✅ Already installed — CLI tools |
| `Microsoft.AspNetCore.Authentication` | 9.0.0 | 🆕 **TO ADD** — Custom authentication handler for Gateway-forwarded headers (`X-User-Id`, `X-User-Roles`) |

### Presentation Layer (`FacilityService.Presentation`)
| Package | Version | Purpose |
|---|---|---|
| `Swashbuckle.AspNetCore` | 10.2.3 | ✅ Already installed — Swagger UI |

---

## 4. Domain Entities (✅ Already Implemented)

### `Cinema`
| Property | Type | Notes |
|---|---|---|
| `Id` | `long` | PK |
| `Name` | `string` | Required |
| `Address` | `string` | Required |
| `City` | `string?` | |
| `Phone` | `string?` | |
| `Active` | `bool` | Default true |
| `Rooms` | `ICollection<Room>` | Navigation |

### `Room`
| Property | Type | Notes |
|---|---|---|
| `Id` | `long` | PK |
| `CinemaId` | `long` | FK → Cinema |
| `Name` | `string` | Required |
| `Type` | `string?` | e.g., 2D, 3D, IMAX |
| `TotalSeats` | `int?` | Auto-calculated |
| `Rows` | `int?` | |
| `Columns` | `int?` | |
| `Active` | `bool` | Default true |
| `UnderMaintenance` | `bool` | Default false |
| `SeatTemplates` | `ICollection<SeatTemplate>` | Navigation |

### `SeatTemplate`
| Property | Type | Notes |
|---|---|---|
| `Id` | `long` | PK |
| `RoomId` | `long` | FK → Room |
| `SeatTypeId` | `long?` | FK → SeatType |
| `RowLabel` | `string` | e.g., "A", "B" |
| `ColumnNumber` | `int` | ≥ 1 |
| `ColumnSpan` | `int?` | Default 1 |
| `Pathway` | `bool` | Is this a walkway? |
| `Active` | `bool` | Default true |

### `SeatType`
| Property | Type | Notes |
|---|---|---|
| `Id` | `long` | PK |
| `Code` | `SeatTypeCode` (enum) | STANDARD, VIP, COUPLE, WHEELCHAIR |
| `Name` | `string` | Required |
| `DisplayName` | `string?` | |
| `PriceMultiplier` | `decimal?` | e.g., 1.0, 1.5, 2.0 |
| `DefaultColumnSpan` | `int?` | Default 1 |
| `Description` | `string?` | |

### Enums
- `SeatTypeCode`: `STANDARD`, `VIP`, `COUPLE`, `WHEELCHAIR`

---

## 5. CQRS — Features (Commands & Queries)

### Cinemas
| Type | Name | Status | Description |
|---|---|---|---|
| Command | `CreateCinemaCommand` | ✅ Done | Create a new cinema |
| Command | `UpdateCinemaCommand` | 🆕 TODO | Update cinema details |
| Command | `DeleteCinemaCommand` | 🆕 TODO | Soft-delete cinema (active=false) |
| Query | `GetCinemasQuery` | ✅ Done | List all cinemas |
| Query | `GetCinemaByIdQuery` | ✅ Exists (file created) | Get cinema by ID |

### Rooms
| Type | Name | Status | Description |
|---|---|---|---|
| Command | `CreateRoomCommand` | ✅ Done | Create room in cinema |
| Command | `UpdateRoomCommand` | ✅ Done | Update room details |
| Command | `DeleteRoomCommand` | ✅ Done | Soft-delete room (active=false) |
| Query | `GetRoomsByCinemaQuery` | ✅ Done | List rooms for a cinema |
| Query | `GetRoomByIdQuery` | ✅ Done | Get room with seat templates |

### SeatTemplates
| Type | Name | Status | Description |
|---|---|---|---|
| Command | `UpdateSeatMapCommand` | ✅ Done | Bulk update seat map |
| Query | `GetSeatTemplatesByRoomQuery` | ✅ Done | Get seat map for a room |

### Internal API
| Type | Name | Status | Description |
|---|---|---|---|
| Query | `GetRoomSeatsInternalQuery` | ✅ Done | Internal: seat data for Showtime Service |

---



---

## 7. API Endpoints

### Cinemas
| Method | Route | Auth | Handler |
|---|---|---|---|
| `POST` | `/api/cinemas` | ✓ (ADMIN) | `CreateCinemaCommand` |
| `GET` | `/api/cinemas` | ✗ | `GetCinemasQuery` |
| `GET` | `/api/cinemas/{id}` | ✗ | `GetCinemaByIdQuery` |
| `PUT` | `/api/cinemas/{id}` | ✓ (ADMIN) | `UpdateCinemaCommand` |
| `DELETE`| `/api/cinemas/{id}` | ✓ (ADMIN) | `DeleteCinemaCommand` |

### Rooms
| Method | Route | Auth | Handler |
|---|---|---|---|
| `POST` | `/api/cinemas/{cinemaId}/rooms` | ✓ (ADMIN) | `CreateRoomCommand` |
| `GET` | `/api/cinemas/{cinemaId}/rooms` | ✗ | `GetRoomsByCinemaQuery` |
| `GET` | `/api/cinemas/{cinemaId}/rooms/{roomId}` | ✗ | `GetRoomByIdQuery` |
| `PUT` | `/api/cinemas/{cinemaId}/rooms/{roomId}` | ✓ (ADMIN) | `UpdateRoomCommand` |
| `DELETE`| `/api/rooms/{roomId}` | ✓ (ADMIN) | `DeleteRoomCommand` |

### Seat Templates
| Method | Route | Auth | Handler |
|---|---|---|---|
| `GET` | `/api/rooms/{roomId}/seats` | ✗ | `GetSeatTemplatesByRoomQuery` |
| `PUT` | `/api/rooms/{roomId}/seats` | ✓ (ADMIN) | `UpdateSeatMapCommand` |

### Internal (blocked at Gateway)
| Method | Route | Auth | Handler |
|---|---|---|---|
| `GET` | `/internal/rooms/{id}/seats` | API Key | `GetRoomSeatsInternalQuery` |

### Health
| Method | Route | Purpose |
|---|---|---|
| `GET` | `/health` | Health check |

---

## 8. Remaining Infrastructure Work

### 8.1 Uncomment & Wire Up
- [ ] `FacilityService.Infrastructure.DependencyInjection.cs` — uncomment DbContext, repos, UnitOfWork registration
- [ ] `FacilityService.Presentation.Program.cs` — uncomment `AddInfrastructure()` call, add `AddApplication()` call

### 8.2 New Files Needed
- [x] `IRoomRepository.cs` — ✅ exists
- [x] `RoomRepository.cs` — ✅ implemented
- [x] `ISeatTypeRepository.cs` — ✅ added
- [ ] `SeatTypeRepository.cs` — implement
- [x] `ISeatTemplateRepository.cs` — ✅ added
- [ ] `SeatTemplateRepository.cs` — implement
- [ ] Update `IUnitOfWork` with `SeatTypes` and `SeatTemplates` properties
- [ ] Add `ExceptionHandlingMiddleware.cs` in Presentation
- [ ] Add EF Configurations for Room, SeatType, SeatTemplate

---

## 9. Folder Structure (Target — complete)

```
facility-service/
├── FacilityService.slnx                                 ✅ Exists
│
├── FacilityService.Domain/                              ✅ Exists
│   ├── FacilityService.Domain.csproj
│   ├── Entities/
│   │   ├── Cinema.cs                                    ✅
│   │   ├── Room.cs                                      ✅
│   │   ├── SeatTemplate.cs                              ✅
│   │   └── SeatType.cs                                  ✅
│   ├── Enums/
│   │   └── SeatTypeCode.cs                              ✅
│   └── Interfaces/
│       ├── ICinemaRepository.cs                         ✅
│       ├── IRoomRepository.cs                           ✅
│       ├── ISeatTypeRepository.cs                       ✅
│       ├── ISeatTemplateRepository.cs                   ✅
│       └── IUnitOfWork.cs                               ✅ (update needed)
│
├── FacilityService.Application/                         ✅ Exists
│   ├── FacilityService.Application.csproj
│   ├── DependencyInjection.cs                           ✅
│   ├── Behaviors/
│   │   └── ValidationBehavior.cs                        ✅
│   ├── DTOs/
│   │   ├── CinemaDto.cs                                 ✅
│   │   ├── RoomDto.cs                                   ✅
│   │   ├── SeatTypeDto.cs                               🆕
│   │   ├── SeatTemplateDto.cs                           ✅
│   │   └── InternalRoomSeatsDto.cs                      ✅
│   ├── Exceptions/
│   │   ├── CinemaNotFoundException.cs                   ✅
│   │   ├── RoomNotFoundException.cs                     ✅
│   │   └── SeatTypeNotFoundException.cs                 🆕
│   └── Features/
│       ├── Cinemas/
│       │   ├── Commands/
│       │   │   ├── CreateCinemaCommand.cs                ✅
│       │   │   ├── UpdateCinemaCommand.cs                🆕
│       │   │   └── DeleteCinemaCommand.cs                🆕
│       │   └── Queries/
│       │       ├── GetCinemasQuery.cs                    ✅
│       │       └── GetCinemaByIdQuery.cs                 ✅
│       ├── Rooms/
│       │   ├── Commands/
│       │   │   ├── CreateRoomCommand.cs                  ✅
│       │   │   ├── UpdateRoomCommand.cs                  ✅
│       │   │   └── DeleteRoomCommand.cs                  ✅
│       │   └── Queries/
│       │       ├── GetRoomsByCinemaQuery.cs              ✅
│       │       └── GetRoomByIdQuery.cs                   ✅
│       └── SeatTemplates/
│           ├── Commands/
│           │   └── UpdateSeatMapCommand.cs               ✅
│           └── Queries/
│               └── GetSeatTemplatesByRoomQuery.cs        ✅
│
├── FacilityService.Infrastructure/                      ✅ Exists
│   ├── FacilityService.Infrastructure.csproj
│   ├── DependencyInjection.cs                           ✅ (uncomment)
│   ├── DatabaseMigration.cs                             ✅
│   ├── Data/
│   │   ├── FacilityDbContext.cs                         ✅
│   │   └── Configurations/
│   │       ├── CinemaConfiguration.cs                   🆕 (check if exists)
│   │       ├── RoomConfiguration.cs                     🆕
│   │       ├── SeatTypeConfiguration.cs                 🆕
│   │       └── SeatTemplateConfiguration.cs             🆕
│   ├── Repositories/
│   │   ├── CinemaRepository.cs                          ✅
│   │   ├── RoomRepository.cs                            ✅
│   │   ├── SeatTypeRepository.cs                        🆕
│   │   ├── SeatTemplateRepository.cs                    🆕
│   │   └── UnitOfWork.cs                                ✅ (update needed)
│
├── FacilityService.Presentation/                        ✅ Exists
│   ├── FacilityService.Presentation.csproj
│   ├── Program.cs                                       ✅ (update needed)
│   ├── appsettings.json                                 ✅
│   ├── appsettings.Development.json                     🆕
│   ├── Properties/
│   │   └── launchSettings.json                          ✅
│   ├── Controllers/
│   │   ├── CinemasController.cs                         ✅ (extend)
│   │   ├── RoomsController.cs                           ✅
│   │   ├── SeatTypesController.cs                       🆕
│   │   ├── SeatTemplatesController.cs                   ✅
│   │   └── InternalRoomsController.cs                   🆕
│   └── Middleware/
│       └── ExceptionHandlingMiddleware.cs               🆕
│
├── FacilityService.Test/                                ✅ Exists (empty)
│   ├── FacilityService.Test.csproj                      🆕
│   ├── Unit/
│   │   ├── Entities/
│   │   │   ├── CinemaTests.cs                           🆕
│   │   │   └── RoomTests.cs                             🆕
│   │   └── Features/
│   │       ├── CreateCinemaCommandHandlerTests.cs       🆕
│   │       └── CreateRoomCommandHandlerTests.cs         🆕
│   └── Integration/
│       └── CinemasControllerTests.cs                    🆕
│
└── Dockerfile                                           🆕
```

---

## 10. Database Schema (`facility_db`)

```sql
CREATE TABLE cinemas (
    id      BIGSERIAL PRIMARY KEY,
    name    VARCHAR(150) NOT NULL,
    address VARCHAR(255) NOT NULL,
    city    VARCHAR(100),
    phone   VARCHAR(20),
    active  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE seat_types (
    id                BIGSERIAL PRIMARY KEY,
    code              VARCHAR(20) NOT NULL,
    name              VARCHAR(100) NOT NULL,
    display_name      VARCHAR(100),
    price_multiplier  DECIMAL(5,2),
    default_col_span  INT DEFAULT 1,
    description       TEXT
);

CREATE TABLE rooms (
    id                BIGSERIAL PRIMARY KEY,
    cinema_id         BIGINT NOT NULL REFERENCES cinemas(id),
    name              VARCHAR(100) NOT NULL,
    type              VARCHAR(20),
    total_seats       INT,
    rows              INT,
    columns           INT,
    active            BOOLEAN NOT NULL DEFAULT TRUE,
    under_maintenance BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE seat_templates (
    id            BIGSERIAL PRIMARY KEY,
    room_id       BIGINT NOT NULL REFERENCES rooms(id),
    seat_type_id  BIGINT REFERENCES seat_types(id),
    row_label     VARCHAR(5) NOT NULL,
    column_number INT NOT NULL CHECK (column_number > 0),
    column_span   INT DEFAULT 1,
    pathway       BOOLEAN NOT NULL DEFAULT FALSE,
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (room_id, row_label, column_number)
);
```

---

## 11. Key Design Decisions

1. **Inline validators**: Validator class defined in the same file as the command (consistent with existing `CreateCinemaCommand.cs` pattern).
2. **Rich domain model**: Entities enforce invariants via constructors and methods — no anemic models (already established).
3. **UnitOfWork pattern**: All repository access goes through `IUnitOfWork` (already established).
4. **Event publishing**: Command handlers call `IEventPublisher.PublishAsync()` after successful `SaveChangesAsync()`.
5. **Rename `Query/` → `Queries/`**: The Rooms feature currently has `Query/` folder — rename to `Queries/` for consistency with Cinemas.
6. **Authentication via Gateway**: This service does not validate JWTs directly. It trusts the API Gateway, reading user identity and roles from the `X-User-Id` and `X-User-Roles` headers to construct the `ClaimsPrincipal`.
