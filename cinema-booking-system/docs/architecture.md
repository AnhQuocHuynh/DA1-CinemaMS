# Cinema Booking System — Microservices Architecture

> **Status**: Active — Migration In Progress | **Last Audited**: 2026-09-11  
> **Origin**: Modular Monolith (Spring Boot 3.3 + PostgreSQL + Redis)  
> **Current State**: Polyglot Microservices (Spring Boot + ASP.NET Core 9) with Database-per-Service  
> **Legacy Rollback**: `backend_legacy/` — intact and runnable monolith

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Analysis](#2-current-architecture-analysis)
3. [Target Microservice Architecture](#3-target-microservice-architecture)
4. [Service Decomposition](#4-service-decomposition)
5. [Technology Assignment — Spring Boot vs ASP.NET](#5-technology-assignment--spring-boot-vs-aspnet)
6. [Database Strategy — Best DB per Service](#6-database-strategy--best-db-per-service)
7. [API Gateway & Routing](#7-api-gateway--routing)
8. [Inter-Service Communication & Messaging](#8-inter-service-communication--messaging)
9. [Shared Infrastructure Services](#9-shared-infrastructure-services)
10. [Security & Authentication](#10-security--authentication)
11. [Data Consistency & Saga Pattern](#11-data-consistency--saga-pattern)
12. [Observability & Monitoring](#12-observability--monitoring)
13. [Deployment Architecture](#13-deployment-architecture)
14. [Frontend Architecture](#14-frontend-architecture)
15. [Migration Status & Roadmap](#15-migration-status--roadmap)
16. [Risk Assessment](#16-risk-assessment)
17. [Recommendation System — Neo4j Graph DB](#17-recommendation-system--neo4j-graph-db)

---

## 1. Executive Summary

The **Cinema Booking System** has been refactored from a **Modular Monolith** (Spring Boot) into a **polyglot microservices architecture**. The original application was organized into well-separated domain modules (`iam`, `catalog`, `booking`, `facility`, `showtime`, `admin`, `staff`, `core`), which provided an excellent foundation for decomposition.

The refactored system splits services between **Spring Boot 3.3 (Java 21)** and **ASP.NET Core 9 (C#)**, leverages **database-per-service** with purpose-chosen databases, uses **RabbitMQ 3.13** for async event-driven communication, routes all traffic through an **API Gateway (YARP)**, and adopts **Keycloak** as the centralized Identity & Access Management (IAM) solution — replacing the monolith's custom JWT/auth implementation.

### Migration Progress

| Area | Status |
|---|---|
| **Spring Boot services** (Catalog, Showtime, Booking, Analytics, Recommendation) | ✅ Migration-prepared — build, test, containerize independently |
| **ASP.NET services** (Identity, Facility, Payment, Notification, API Gateway) | ✅ Implemented — Clean Architecture with MediatR/CQRS |
| **Infrastructure** (Keycloak, RabbitMQ, Neo4j, MongoDB, Observability) | ✅ Provisioned in Docker Compose |
| **Cross-workstream integration** | 🔄 In progress — JWT activation, Payment→Booking saga wiring, frontend booking flow |
| **Production cutover** | ⬜ Blocked on integration gates (see §15) |

### Key Goals

| Goal | Rationale |
|---|---|
| Independent deployability | Each service can be deployed, scaled, and updated independently |
| Technology diversity | Use the best stack for each domain (Spring Boot for data-heavy services, ASP.NET for high-perf real-time services) |
| Fault isolation | A failure in one service doesn't cascade to others |
| Team autonomy | Different teams can own different services with clear boundaries |
| Scalability | Scale hot services (booking, showtime) independently from cold ones (catalog) |

---

## 2. Current Architecture Analysis

### 2.1 Original Module Structure (Monolith)

```
com.uit.cinema/
├── core/           → Cross-cutting: Security (JWT), Config, Exceptions
├── iam/            → Identity: User, Role, Auth, RefreshToken, PasswordReset
├── catalog/        → Content: Movie, Event, Genre, MovieGenre
├── facility/       → Infrastructure: Cinema, Room, SeatTemplate, SeatType
├── showtime/       → Scheduling: Showtime, ShowtimeSeat, SeatLocking (Redis)
├── booking/        → Transactions: Order, Ticket, Voucher, Payment, Review
├── admin/          → Admin Dashboard: Revenue analytics, live sales, popular movies
└── staff/          → Staff Ops: Counter booking, staff dashboard
```

### 2.2 Original Tech Stack

| Component | Technology |
|---|---|
| Runtime | Java 21, Spring Boot 3.3.4 |
| Database | PostgreSQL 16 (single shared DB: `cinema_db`) |
| Cache | Redis 7 (seat holding TTL, token blacklist) |
| Auth | Spring Security + JWT (jjwt 0.12.6) |
| ORM | Spring Data JPA / Hibernate |
| Mapping | MapStruct 1.5.5 |
| Build | Maven |
| Container | Docker + Docker Compose |

### 2.3 Cross-Module Dependencies (Coupling Analysis)

The following cross-module dependencies existed in the monolith and have been resolved during decomposition:

| From Module | To Module | Dependency Type | Resolution |
|---|---|---|---|
| `booking.OrderServiceImpl` | `showtime.ShowtimeSeatRepository` | **Direct DB access** | → HTTP internal API (`/internal/seats/validate`) |
| `booking.PaymentServiceImpl` | `showtime.ShowtimeSeatRepository` | **Direct DB access** | → HTTP internal API (`/internal/seats/confirm`) |
| `booking.PaymentServiceImpl` | `showtime.ShowtimeRepository` | **Direct DB access** | → HTTP internal API (`GET /internal/showtimes/{id}`) |
| `staff.StaffBookingController` | `booking.dto` | **Shared DTO** | → Kept in Booking Service; staff routes via Gateway |
| `admin.AdminDashboardServiceImpl` | `booking.*`, `catalog.*`, `iam.*` | **Cross-module queries** | → Analytics read-model (event-sourced from RabbitMQ) |
| All modules | `core.security` | **Shared auth** | → Keycloak OIDC + gateway-injected headers |
| All modules | `core.exception` | **Shared exceptions** | → Per-service exception handling; `Shared.Hosting` for .NET |

---

## 3. Target Microservice Architecture

### 3.1 High-Level Architecture Diagram

```
                          ┌──────────────────────────────────────────────┐
                          │              React Frontend (SPA)            │
                          │   Vite + TailwindCSS + keycloak-js + Zustand │
                          │   User Portal / Admin Dashboard / Staff UI   │
                          └──────────────────┬───────────────────────────┘
                                             │ HTTPS
                                             ▼
                          ┌──────────────────────────────────────────────┐
                          │           API GATEWAY (YARP)                  │
                          │     ASP.NET Core 9 — Port 5000               │
                          │  ─────────────────────────────────────────── │
                          │  • Route Aggregation    • Rate Limiting       │
                          │  • JWT Validation       • Load Balancing      │
                          │    (Keycloak OIDC)      • CORS                │
                          │  • User ID Resolution   • /internal/** block  │
                          │  • X-Internal-Token      • Circuit Breaker    │
                          │    injection (downstream)                     │
                          └──┬────┬────┬────┬────┬────┬────┬────┬───────┘
                             │    │    │    │    │    │    │    │
              ┌──────────────┘    │    │    │    │    │    │    └──────────────┐
              │       ┌───────────┘    │    │    │    │    └────────┐         │
              ▼       ▼               ▼    │    ▼    ▼              ▼         ▼
         ┌────────┬────────┐    ┌─────────┐│┌────────┬─────────┐┌────────┬────────┐
         │Identity│Catalog │    │Facility │││Showtime│ Booking  ││Payment │Notif.  │
         │Service │Service │    │Service  │││Service │ Service  ││Service │Service │
         │(ASP.NET│(Spring │    │(ASP.NET │││(Spring │(Spring   ││(ASP.NET│(ASP.NET│
         │Core 9) │ Boot)  │    │ Core 9) │││ Boot)  │ Boot)    ││Core 9) │Core 9) │
         │ :5001  │ :8081  │    │ :5002   │││ :8082  │ :8083    ││ :5003  │ :5004  │
         └───┬────┴───┬────┘    └───┬─────┘│└───┬────┴───┬─────┘└───┬────┴───┬────┘
             │        │             │      │    │        │          │        │
             ▼        ▼             ▼      │    ▼        ▼          ▼        ▼
         ┌────────┬────────┐   ┌─────────┐ │ ┌────────┬────────┐┌────────┬────────┐
         │Postgres│Postgres│   │Postgres │ │ │Redis + │Postgres││Postgres│MongoDB │
         │usr_    │cat_    │   │fac_     │ │ │Postgres│bkg_    ││pay_    │notif_  │
         │prof_db │log_db  │   │  _db    │ │ │        │  _db   ││  _db   │  _db   │
         └────────┴────────┘   └─────────┘ │ └────────┴────────┘└────────┴────────┘
                                           │
                                     ┌─────▼──────────────────────────────────────┐
                                     │         Analytics Service                   │
                                     │           (Spring Boot) :8084               │
                                     │          ┌──────────────┐                   │
                                     │          │ PostgreSQL   │                   │
                                     │          │analytics_db  │                   │
                                     │          └──────────────┘                   │
                                     └─────────────────────────────────────────────┘

                                     ┌─────────────────────────────────────────────┐
                                     │         Recommendation Service               │
                                     │           (Spring Boot) :8085                │
                                     │          ┌──────────────┐                    │
                                     │          │  Neo4j 5.23  │                    │
                                     │          └──────────────┘                    │
                                     └─────────────────────────────────────────────┘

                          ┌──────────────────────────────────────────────┐
                          │         RabbitMQ 3.13 (Message Broker)        │
                          │   Exchanges: booking.*, payment.*, user.*    │
                          │   seat.*, catalog.*, recommendation.*        │
                          └──────────────────────────────────────────────┘

                          ┌──────────────────────────────────────────────┐
                          │        Shared Infrastructure                  │
                          │  ┌─────────┐  ┌──────────┐  ┌────────────┐  │
                          │  │Keycloak │  │  OTel    │  │  Grafana   │  │
                          │  │  (IAM)  │  │Collector │  │ Tempo+Loki │  │
                          │  │ :8080   │  │          │  │ Prometheus │  │
                          │  └─────────┘  └──────────┘  └────────────┘  │
                          └──────────────────────────────────────────────┘
```

---

## 4. Service Decomposition

### 4.1 Service Catalog

| # | Service Name | Bounded Context | Responsibility |
|---|---|---|---|
| 1 | **Identity Service** | User Profile | Extended user profile management, Keycloak UUID→Long ID mapping, profile sync from Keycloak events, internal user lookup, Keycloak Admin API integration for role changes |
| 2 | **Catalog Service** | Catalog | Movie CRUD, Event CRUD, Genre management, catalog search/browse, transactional outbox for catalog events |
| 3 | **Facility Service** | Facility | Cinema management, Room management, Seat template & seat type configuration, internal seat projection APIs, Redis caching, future-showtime delete guards |
| 4 | **Showtime Service** | Showtime | Showtime scheduling, ShowtimeSeat generation, seat map queries, seat hold/release (Redis TTL), internal seat validation/confirmation/release APIs |
| 5 | **Booking Service** | Booking | Order lifecycle (create → pay → refund → cancel), ticket generation, voucher validation & application, review management, staff booking, payment event consumers |
| 6 | **Payment Service** | Payment | Payment processing (Stripe, PayPal, Cash), MassTransit saga state machine, refund processing, transactional outbox, EF Core persistence |
| 7 | **Notification Service** | Notification | Email/SMS/push for booking confirmations, payment receipts, password resets, user welcome; MongoDB storage; MassTransit consumers |
| 8 | **Analytics Service** | Analytics | Admin dashboard aggregations, revenue series, popular movies, live sales, staff dashboard KPIs; event-sourced read model |
| 9 | **API Gateway** | Infrastructure | YARP reverse proxy, JWT validation, user ID resolution, rate limiting, internal token injection, `/internal/**` blocking |
| 10 | **Recommendation Service** | Recommendation | Personalized movie recommendations via collaborative filtering (Neo4j graph traversal), content-based genre matching, popularity fallback |

### 4.2 Domain Ownership Matrix

| Entity | Owning Service | Consumers (via API/Events) |
|---|---|---|
| `User` (profile data), `KeycloakId` mapping | Identity Service | All services (user lookup) |
| Auth identity (credentials, roles, tokens, sessions) | **Keycloak** (external) | All services (JWT validation via OIDC) |
| `Movie`, `Event`, `Genre`, `MovieGenre` | Catalog Service | Showtime, Booking, Analytics, Recommendation |
| `Cinema`, `Room`, `SeatTemplate`, `SeatType` | Facility Service | Showtime, Booking, Analytics |
| `Showtime`, `ShowtimeSeat` | Showtime Service | Booking, Analytics |
| `Order`, `Ticket`, `Voucher` | Booking Service | Payment, Analytics, Notification |
| `Review` | Booking Service | Catalog (avg rating), Analytics, Recommendation |
| `Payment`, `Refund`, `TransactionLog` | Payment Service | Booking, Analytics, Notification |
| Recommendation graph (User→Movie edges) | Recommendation Service | Frontend (via API Gateway) |

---

## 5. Technology Assignment — Spring Boot vs ASP.NET

### 5.1 Decision Matrix

| Service | Framework | Language | Architecture Pattern | Rationale |
|---|---|---|---|---|
| **Identity Service** | **ASP.NET Core 9** | C# | Clean Architecture + MediatR CQRS | Lightweight profile management; syncs with Keycloak via events; EF Core + Npgsql; Keycloak Admin API client |
| **Catalog Service** | **Spring Boot 3.3** | Java 21 | Layered (Controller/Service/Repository) | Data-heavy CRUD with complex JPA relationships (Movie↔Genre M:N), MapStruct mappers, transactional outbox |
| **Facility Service** | **ASP.NET Core 9** | C# | Clean Architecture + MediatR CQRS | EF Core migrations, Redis caching, internal seat projection APIs, showtime-delete guards |
| **Showtime Service** | **Spring Boot 3.3** | Java 21 | Layered + Redis seat locking | Complex seat locking with dedicated Redis, seat reservation service, internal APIs for booking |
| **Booking Service** | **Spring Boot 3.3** | Java 21 | Layered + Outbox + Event consumers | Most complex domain logic, cross-service orchestration, payment event consumers, review management |
| **Payment Service** | **ASP.NET Core 9** | C# | Clean Architecture + MassTransit Saga | MassTransit saga state machine, EF Core outbox, multiple payment gateway adapters (Stripe, PayPal, Cash) |
| **Notification Service** | **ASP.NET Core 9** | C# | Clean Architecture + Background Services | MongoDB persistence, MassTransit consumers, channel-based notification dispatch |
| **Analytics Service** | **Spring Boot 3.3** | Java 21 | Read-model + Event consumers | Event-sourced read model, SQL aggregation queries, RabbitMQ consumers |
| **API Gateway** | **ASP.NET Core 9** | C# | YARP Reverse Proxy | High-performance routing, JWT validation, user ID resolution middleware |
| **Recommendation Service** | **Spring Boot 3.3** | Java 21 | Spring Data Neo4j + Event consumers | Graph DB for collaborative filtering, Neo4j Cypher queries, event-driven graph sync |

### 5.2 Summary Split

```
┌─────────────────────────────────┬──────────────────────────────────┐
│     Spring Boot 3.3 (Java 21)   │      ASP.NET Core 9 (C#)         │
├─────────────────────────────────┼──────────────────────────────────┤
│ • Catalog Service               │ • Identity Service               │
│ • Showtime Service              │ • Facility Service               │
│ • Booking Service               │ • Payment Service                │
│ • Analytics Service             │ • Notification Service           │
│ • Recommendation Service        │ • API Gateway (YARP)             │
├─────────────────────────────────┼──────────────────────────────────┤
│  5 services                     │  5 services (incl. gateway)      │
│  Maven multi-module build       │  Clean Architecture per service  │
│  MapStruct + Lombok             │  MediatR + FluentValidation      │
│  Spring AMQP                    │  MassTransit (RabbitMQ)          │
│  Shared parent POM              │  Shared.Hosting NuGet library    │
└─────────────────────────────────┴──────────────────────────────────┘
```

### 5.3 Shared Libraries

| Library | Stack | Location | Purpose |
|---|---|---|---|
| **CinemaBooking.Shared.Hosting** | .NET 9 | `backend/shared/Shared.Hosting/` | JWT authentication setup, OpenTelemetry instrumentation (ASP.NET Core, HTTP, EF Core, Redis, Runtime, Process), internal API security middleware |
| **Parent POM** | Java 21 | `backend/pom.xml` | Spring Boot BOM management, MapStruct/Lombok processor config, shared compiler settings |
| **Shared Contracts** | Both | `backend/shared/contracts/` | OpenAPI specs per service (8 files) |
| **Shared Events** | Both | `backend/shared/events/` | Event schema documentation (booking, catalog, payment events) |

---

## 6. Database Strategy — Best DB per Service

### 6.1 Database Selection

| Service | Primary Database | Why This DB | Schema/DB Name |
|---|---|---|---|
| **Identity Service** | **PostgreSQL 18** | User profile data (extended fields, preferences); `keycloak_id` mapping to Keycloak UUID | `user_profile_db` |
| **Catalog Service** | **PostgreSQL 18** | Complex M:N relationships (Movie↔Genre), full-text search potential, JSONB for flexible metadata | `cinema_catalog_db` |
| **Facility Service** | **PostgreSQL 18** | Relational data (Cinema→Room→SeatTemplate), spatial potential (PostGIS for cinema locations) | `facility_db` |
| **Showtime Service** | **PostgreSQL 18** + **Redis 7** (dedicated) | PostgreSQL for showtime/seat persistence; dedicated Redis instance for transient seat holds (TTL-based distributed locks) | `cinema_showtime_db` + `showtime-redis:6380` |
| **Booking Service** | **PostgreSQL 18** | Financial data (orders, amounts), ACID transactions critical for money, audit trail | `cinema_booking_db` |
| **Payment Service** | **PostgreSQL 18** | Transactional integrity paramount for payment records; MassTransit saga state + outbox persistence | `payment_db` |
| **Notification Service** | **MongoDB 6** | Schema-flexible for diverse notification templates (email/SMS/push); TTL indexes for auto-expiry of old notifications | `cinema_notification_db` |
| **Analytics Service** | **PostgreSQL 18** | Event-sourced read model with SQL aggregation queries; repeatable backfill from upstream services | `cinema_analytics_db` |
| **Keycloak** | **PostgreSQL 18** | Keycloak's built-in JDBC persistence for realm config, users, sessions | `keycloak_db` |
| **Recommendation Service** | **Neo4j 5.23** (graph) | Native graph DB for relationship traversal (collaborative filtering); O(relationship-count) queries vs O(table-size) JOINs | `graph_db` |

> **Dev Topology**: All PostgreSQL databases run in a **single PostgreSQL 18 container** (`cinema-postgres`) initialized by `init-multiple-databases.sql`. Production should use separate instances per database.

### 6.2 Caching Strategy

| Service | Cache | Usage |
|---|---|---|
| Identity Service | Via API Gateway Redis | User ID resolution cache |
| Catalog Service | — | Movie listing (potential future Redis) |
| Facility Service | **Redis** (`cinema-redis`) | Room/cinema query caching |
| Showtime Service | **Redis** (`showtime-redis`, dedicated on :6380) | Seat hold locks (TTL-based), seat map cache |
| Booking Service | — | Order idempotency keys (potential) |
| API Gateway | **Redis** (`cinema-redis`) | Rate limiting counters, user ID resolution cache |
| Recommendation Service | — | Personalized recommendation cache (potential) |

### 6.3 Database Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                PostgreSQL 18 (Single Container — Dev)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │user_     │ │cinema_   │ │facility  │ │cinema_   │ │cinema_   │ │
│  │profile   │ │catalog   │ │  _db     │ │showtime  │ │booking   │ │
│  │  _db     │ │  _db     │ │          │ │  _db     │ │  _db     │ │
│  │          │ │          │ │          │ │          │ │          │ │
│  │• users   │ │• movies  │ │• cinemas │ │• show-   │ │• orders  │ │
│  │• keycloak│ │• events  │ │• rooms   │ │  times   │ │• tickets │ │
│  │  _id map │ │• genres  │ │• seat_   │ │• show-   │ │• vouchers│ │
│  │          │ │• movie_  │ │  templates│ │  time_  │ │• reviews │ │
│  │          │ │  genres  │ │• seat_   │ │  seats   │ │          │ │
│  │          │ │• outbox  │ │  types   │ │          │ │• outbox  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                           │
│  │payment   │ │cinema_   │ │keycloak  │                           │
│  │  _db     │ │analytics │ │  _db     │                           │
│  │• payments│ │  _db     │ │(managed  │                           │
│  │• refunds │ │• read    │ │ by KC)   │                           │
│  │• txn_log │ │  model   │ │          │                           │
│  │• saga    │ │  tables  │ │          │                           │
│  │  state   │ │          │ │          │                           │
│  │• outbox  │ │          │ │          │                           │
│  └──────────┘ └──────────┘ └──────────┘                           │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐  ┌──────────────────┐  ┌──────────────┐
│  Redis 7     │  │  MongoDB 6       │  │ Neo4j 5.23   │
│  (× 2)       │  │                  │  │  Community   │
│              │  │• cinema_notif_db │  │              │
│cinema-redis: │  │  └ notifications │  │• graph_db    │
│• rate_limits │  │  └ templates     │  │  └ users     │
│• facility    │  │  └ delivery_log  │  │  └ movies    │
│  cache       │  │                  │  │  └ genres    │
│              │  │                  │  │  └ WATCHED   │
│showtime-redis│  │                  │  │  └ RATED     │
│• seat_holds  │  │                  │  │  └ SIMILAR_TO│
│  (dedicated) │  │                  │  │              │
└──────────────┘  └──────────────────┘  └──────────────┘
```

---

## 7. API Gateway & Routing

### 7.1 Gateway Technology: **YARP (ASP.NET Core 9)**

[YARP](https://microsoft.github.io/reverse-proxy/) (Yet Another Reverse Proxy) is chosen for:
- Native .NET integration with the ASP.NET middleware pipeline
- High performance (~500K+ RPS on commodity hardware)
- Dynamic route configuration (hot-reload from config/DB)
- Built-in load balancing, health checks, and session affinity

### 7.2 Route Table

| Route Pattern | Target Service | Method | Auth Required | Rate Limit |
|---|---|---|---|---|
| `/api/auth/**` | Keycloak `:8080` | ALL | ✗ | 20 req/min |
| `/api/users/**` | Identity Service `:5001` | ALL | ✓ | 60 req/min |
| `/api/movies/**` | Catalog Service `:8081` | GET | ✗ | 120 req/min |
| `/api/movies/**` | Catalog Service `:8081` | POST/PUT/DELETE | ✓ (ADMIN) | 30 req/min |
| `/api/events/**` | Catalog Service `:8081` | GET | ✗ | 120 req/min |
| `/api/events/**` | Catalog Service `:8081` | POST/PUT/DELETE | ✓ (ADMIN) | 30 req/min |
| `/api/genres/**` | Catalog Service `:8081` | ALL | Mixed | 60 req/min |
| `/api/catalog/**` | Catalog Service `:8081` | GET | ✗ | 120 req/min |
| `/api/cinemas/**` | Facility Service `:5002` | GET | ✗ | 120 req/min |
| `/api/cinemas/**` | Facility Service `:5002` | POST/PUT/DELETE | ✓ (ADMIN) | 30 req/min |
| `/api/showtimes/**` | Showtime Service `:8082` | GET | ✗ | 200 req/min |
| `/api/showtimes/**` | Showtime Service `:8082` | POST/DELETE | ✓ (ADMIN/STAFF) | 30 req/min |
| `/api/showtimes/*/hold` | Showtime Service `:8082` | POST/DELETE | ✓ | 60 req/min |
| `/api/orders/**` | Booking Service `:8083` | ALL | ✓ | 30 req/min |
| `/api/tickets/**` | Booking Service `:8083` | ALL | ✓ | 60 req/min |
| `/api/vouchers/**` | Booking Service `:8083` | ALL | Mixed | 60 req/min |
| `/api/reviews/**` | Booking Service `:8083` | ALL | Mixed | 30 req/min |
| `/api/payments/**` | Payment Service `:5003` | ALL | ✓ | 20 req/min |
| `/api/admin/dashboard/**` | Analytics Service `:8084` | GET | ✓ (ADMIN) | 30 req/min |
| `/api/staff/**` | Booking Service `:8083` | ALL | ✓ (STAFF) | 60 req/min |
| `/api/recommendations/**` | Recommendation Service `:8085` | GET | Mixed | 60 req/min |

### 7.3 Gateway Responsibilities

```
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway (YARP)                      │
│                                                              │
│  ┌─────────────┐  ┌────────────┐  ┌───────────────────────┐ │
│  │ JWT         │  │ Rate       │  │ Circuit Breaker       │ │
│  │ Validation  │→ │ Limiting   │→ │ (Polly)               │ │
│  │ (Keycloak   │  │ (Redis)    │  │                       │ │
│  │  OIDC/JWKS) │  │            │  │                       │ │
│  └─────────────┘  └────────────┘  └───────────────────────┘ │
│           │                                │                 │
│           ▼                                ▼                 │
│  ┌─────────────┐  ┌────────────┐  ┌───────────────────────┐ │
│  │ User ID     │  │ X-Internal │  │ /internal/**          │ │
│  │ Resolution  │  │ -Token     │  │ Blocking              │ │
│  │ (UUID→Long) │  │ Injection  │  │ (external requests)   │ │
│  └─────────────┘  └────────────┘  └───────────────────────┘ │
│           │                                │                 │
│           ▼                                ▼                 │
│  ┌─────────────┐  ┌────────────┐  ┌───────────────────────┐ │
│  │ CORS        │  │ Request    │  │ Health Check          │ │
│  │ Handling    │  │ Logging    │  │ Aggregation           │ │
│  └─────────────┘  └────────────┘  └───────────────────────┘ │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Route → Downstream Service                 │ │
│  │              Headers: X-User-Id, X-Keycloak-Id,        │ │
│  │              X-User-Email, X-User-Roles                │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Inter-Service Communication & Messaging

### 8.1 Communication Patterns

| Pattern | Use Case | Technology |
|---|---|---|
| **Synchronous (REST/HTTP)** | Real-time queries that need immediate response | HTTP + Resilience4j/Polly |
| **Asynchronous (Events)** | Fire-and-forget notifications, eventual consistency | RabbitMQ (AMQP) |
| **Request-Reply (Async)** | Cross-service data enrichment with timeout | RabbitMQ RPC |

### 8.2 Synchronous API Calls (Service-to-Service)

| Caller | Callee | Endpoint | Purpose |
|---|---|---|---|
| Booking Service | Showtime Service | `GET /internal/showtimes/{id}` | Validate showtime exists, get start time for refund window |
| Booking Service | Showtime Service | `POST /internal/seats/validate` | Validate held seats before order creation |
| Booking Service | Showtime Service | `POST /internal/seats/confirm` | Confirm seats as BOOKED after payment |
| Booking Service | Showtime Service | `POST /internal/seats/release` | Release seats on order cancellation |
| Booking Service | Catalog Service | `GET /internal/movies/{id}` | Movie info for order enrichment |
| Booking Service | Facility Service | `GET /internal/rooms/{id}/seats` | Room/seat info |
| Showtime Service | Catalog Service | `GET /internal/movies/{id}` | Movie validation for showtime creation |
| Showtime Service | Facility Service | `GET /internal/rooms/{id}/seats` | Room + seat templates for ShowtimeSeat generation |
| Analytics Service | Catalog Service | `GET /internal/movies/{id}` | Enrich analytics with movie titles |
| Analytics Service | Identity Service | `GET /internal/users/count` | Get total user count for dashboard |
| API Gateway | Identity Service | `GET /internal/users/resolve?keycloakId={uuid}` | Resolve Keycloak UUID → internal Long user ID (cached) |

> **Internal API Security**: All internal APIs use the `/internal/` prefix and are protected by `X-Internal-Token` header. Gateway blocks external access to `/internal/**` routes. Spring services use `InternalApiSecurityFilter`; .NET services use `InternalApiSecurityMiddleware` from `Shared.Hosting`.

### 8.3 Asynchronous Events (RabbitMQ)

#### Message Broker: **RabbitMQ 3.13**

**Why RabbitMQ over Kafka?**
- Better fit for command/event patterns at this scale
- Built-in dead-letter queues for failed message retry
- Simpler operational overhead
- Excellent Spring AMQP and MassTransit (.NET) library support

#### Exchange & Queue Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        RabbitMQ Topology                         │
│                                                                  │
│  Exchange: user.events (topic)                                   │
│  ├── user.registered    → Queue: notification.user.welcome       │
│  ├── user.registered    → Queue: analytics.user.registered       │
│  ├── user.registered    → Queue: recommendation.user.registered  │
│  ├── user.profile.updated→ Queue: notification.profile.updated   │
│  ├── user.deleted       → Queue: identity.user.deleted           │
│  ├── user.deleted       → Queue: analytics.user.deleted          │
│  └── user.password.reset→ Queue: notification.password.reset     │
│                                                                  │
│  Exchange: booking.events (topic)                                │
│  ├── order.created      → Queue: analytics.order.created         │
│  ├── order.paid         → Queue: notification.order.confirmation │
│  ├── order.paid         → Queue: analytics.order.paid            │
│  ├── order.paid         → Queue: payment.process                 │
│  ├── order.paid         → Queue: recommendation.order.paid       │
│  ├── review.created     → Queue: recommendation.review.created   │
│  ├── review.updated     → Queue: recommendation.review.updated   │
│  ├── order.refunded     → Queue: notification.order.refund       │
│  ├── order.refunded     → Queue: analytics.order.refunded        │
│  └── order.cancelled    → Queue: showtime.seats.release          │
│                                                                  │
│  Exchange: payment.events (topic)                                │
│  ├── payment.completed  → Queue: booking.payment.completed       │
│  ├── payment.failed     → Queue: booking.payment.failed          │
│  └── payment.refunded   → Queue: booking.refund.completed        │
│                                                                  │
│  Exchange: showtime.events (topic)                               │
│  ├── seat.held          → Queue: analytics.seat.activity         │
│  ├── seat.booked        → Queue: analytics.seat.activity         │
│  ├── seat.released      → Queue: analytics.seat.activity         │
│  └── showtime.created   → Queue: notification.showtime.new       │
│                                                                  │
│  Exchange: catalog.events (topic)                                │
│  ├── movie.created      → Queue: analytics.movie.created         │
│  ├── movie.created      → Queue: recommendation.movie.created    │
│  ├── movie.updated      → Queue: analytics.movie.updated         │
│  └── movie.updated      → Queue: recommendation.movie.updated    │
│                                                                  │
│  Dead Letter Exchange: dlx.exchange                              │
│  └── *.failed           → Queue: dlq.all (manual inspection)     │
└─────────────────────────────────────────────────────────────────┘
```

#### Event Envelope (Spring Boot Standard)

All Spring services use a versioned envelope:

```json
{
  "eventId": "uuid-v4",
  "eventType": "order.paid",
  "occurredAt": "2026-06-26T12:00:00Z",
  "schemaVersion": 1,
  "source": "booking-service",
  "payload": {
    "orderId": 1234,
    "userId": 42,
    "showtimeId": 567,
    "movieId": 10,
    "eventId": 1,
    "totalAmount": 450000.00,
    "finalAmount": 405000.00,
    "ticketCount": 3,
    "paymentMethod": "CREDIT_CARD",
    "transactionId": "TXN-123456789"
  }
}
```

#### Keycloak-Originated Events

Published by the custom **Keycloak SPI** (`RabbitMqEventListenerProvider`):

| Keycloak Event | Published As | Trigger |
|---|---|---|
| `EventType.REGISTER` | `user.registered` | Self-registration via login/register UI |
| `AdminEvent CREATE USER` | `user.registered` | Admin creates user (payload enriched via `UserModel`) |
| `EventType.DELETE_ACCOUNT` | `user.deleted` | User self-deletes account |
| `AdminEvent DELETE USER` | `user.deleted` | Admin deletes user |
| Password reset | `user.password.reset` | For Notification Service |

### 8.4 Library Choices

| Stack | Async Messaging Library | HTTP Client |
|---|---|---|
| Spring Boot | **Spring AMQP** (`spring-boot-starter-amqp`) | **RestClient** with Resilience4j |
| ASP.NET Core | **MassTransit 8.x** (over RabbitMQ transport) | **HttpClientFactory** with Polly |

### 8.5 Outbox Pattern (Implemented)

| Service | Outbox Implementation | Details |
|---|---|---|
| Catalog Service (Spring) | Custom transactional outbox | Publisher confirms, mandatory routing, bounded retries, terminal failed-event state |
| Booking Service (Spring) | Custom transactional outbox | Same pattern as Catalog; `OUTBOX_DISPATCHER_ENABLED` flag |
| Payment Service (.NET) | MassTransit EF Core Outbox | `AddEntityFrameworkOutbox<PaymentDbContext>` with PostgreSQL and BusOutbox |

---

## 9. Shared Infrastructure Services

### 9.1 Service Discovery

| Environment | Technology | Notes |
|---|---|---|
| **Development** | **Docker Compose service names** | Zero-config; services resolve via `http://catalog-service:8081` |
| **Production** | **Kubernetes DNS** | Standard ClusterIP service resolution |

### 9.2 Configuration Management

| Stack | Technology |
|---|---|
| Spring Boot services | Environment variables via Docker Compose (`SPRING_*`, `CINEMA_*`, `KEYCLOAK_*`) |
| ASP.NET services | `.env` file + environment variable overrides (`ConnectionStrings__*`, `RabbitMQ__*`, `Jwt__*`) |
| Secrets | Docker Compose `.env` file (dev); K8s Secrets (production) |
| Keycloak | Realm export JSON (`cinema-booking-realm.json`) auto-imported on startup |

### 9.3 Keycloak Custom Extensions

| Extension | Location | Purpose |
|---|---|---|
| **RabbitMQ Event Listener SPI** | `infrastructure/keycloak-spi/` | Java JAR with 3 classes: `RabbitMqEventListenerProvider`, `RabbitMqEventListenerProviderFactory`, `RabbitMqPublisher` — publishes user lifecycle events to RabbitMQ |
| **Cinema Theme** | `infrastructure/keycloak-themes/cinema-theme/` | Custom branded login theme with FreeMarker templates: `login.ftl`, `register.ftl`, `login-reset-password.ftl`, `login-update-password.ftl`, `template.ftl`; i18n messages (Vietnamese) |
| **Realm Config** | `infrastructure/keycloak-config/cinema-booking-realm.json` | Full realm export (97 KB) with clients, roles, scopes, auth flows |

---

## 10. Security & Authentication (Keycloak)

### 10.1 Keycloak as Centralized IAM

All authentication, authorization, user credentials, roles, sessions, and token management are handled by **Keycloak** — an open-source Identity and Access Management solution. No microservice issues its own JWTs.

### 10.2 Authentication Flow (OIDC)

```
                    ┌──────────┐
                    │  Client  │
                    └────┬─────┘
                         │ 1. POST /realms/cinema-booking/protocol/openid-connect/token
                         │    (grant_type=password, client_id, username, password)
                         ▼
                    ┌──────────┐
                    │   API    │ 2. Proxies to Keycloak
                    │ Gateway  │    (or client calls Keycloak directly)
                    └────┬─────┘
                         │
                         ▼
                    ┌──────────┐
                    │ Keycloak │ ← Issues RS256 JWT with claims:
                    │          │   {sub (UUID), email, realm_access.roles[],
                    └──────────┘    preferred_username, exp, iss, aud}
                                ← Also returns refresh_token
                                                                  
      ┌───────────────── Subsequent Requests ─────────────────────┐
      │                                                           │
      │  3. Client sends: Authorization: Bearer <JWT>             │
      ▼                                                           │
 ┌──────────┐   4. Gateway validates JWT signature    ┌──────────┐│
 │   API    │ ──── (using Keycloak's JWKS endpoint ──►│ Upstream ││
 │ Gateway  │      /realms/cinema-booking/protocol/   │ Service  ││
 └──────────┘      openid-connect/certs)              └──────────┘│
                5. Gateway resolves Keycloak UUID →                │
                   internal Long user ID via                      │
                   Identity Service cache                         │
                6. Forwards headers to upstream:                  │
                   X-User-Id (Long), X-Keycloak-Id (UUID),       │
                   X-User-Email, X-User-Roles                    │
                                                                   │
                ┌──────────────────────────────────────────────────┘
                │ Token refresh:
                │ POST /realms/cinema-booking/protocol/openid-connect/token
                │   (grant_type=refresh_token, refresh_token=...)
                └──────────────────────────────────────────────────
```

### 10.3 Token Strategy

| Token | Issuer | Storage | TTL |
|---|---|---|---|
| Access Token (JWT, RS256) | **Keycloak** | Client-side (memory/localStorage) | 5 min |
| Refresh Token | **Keycloak** | HTTP-only cookie / client-side | 30 min (sliding) |
| Offline Token | **Keycloak** | Client-side (for long-lived sessions) | Configurable |
| Internal Service Token | API Gateway | Header-injected (`X-Internal-Token`) | Per-request |

### 10.4 User ID Resolution Strategy

The legacy system uses `Long` IDs for users. Keycloak uses `UUID` strings. To maintain backward compatibility:

1. **Identity Service** maintains a `users` table with both `id` (internal `Long`, auto-increment) and `keycloak_id` (UUID, unique)
2. When a user registers (via Keycloak), the Keycloak Event Listener SPI publishes a `user.registered` event to RabbitMQ
3. The Identity Service consumes this event and creates a local user profile record
4. The **API Gateway** resolves `sub` (UUID) → `X-User-Id` (Long) via a cached lookup to the Identity Service's `/internal/users/resolve?keycloakId={uuid}` endpoint
5. Downstream services continue using `Long` user IDs — no migration needed for `Order.userId`, `Payment.userId`, etc.

### 10.5 Keycloak Realm Configuration

| Setting | Value |
|---|---|
| Realm name | `cinema-booking` |
| Login theme | Custom branded theme (`cinema-theme`) |
| Registration | Enabled (self-registration) |
| Email verification | Required |
| Password policy | Min 8 chars, 1 uppercase, 1 digit |
| Brute force protection | Enabled (5 failures → 30s lockout) |
| Default roles | `CUSTOMER` (auto-assigned on registration) |
| Admin-managed roles | `ADMIN`, `STAFF` (assigned via Keycloak admin console) |

### 10.6 Keycloak Clients

| Client ID | Type | Purpose |
|---|---|---|
| `cinema-frontend` | Public (PKCE) | React SPA — Authorization Code flow with PKCE |
| `cinema-api-gateway` | Confidential | Gateway validates tokens, exchanges tokens |
| `cinema-admin` | Confidential | Admin operations — service account for Keycloak Admin REST API |

### 10.7 Key Security Decisions

1. **Keycloak as single source of truth for auth**: No microservice stores passwords, issues tokens, or manages sessions.
2. **RS256 asymmetric signing**: Keycloak signs JWTs with its private key; all services validate using Keycloak's JWKS endpoint.
3. **Token revocation**: Keycloak handles token revocation via its built-in revocation endpoint.
4. **Internal APIs**: Protected via `X-Internal-Token` header (transitional; target is per-service Keycloak client-credentials). Gateway blocks `/internal/**` from external requests.
5. **RBAC**: Keycloak realm roles (`ADMIN`, `STAFF`, `CUSTOMER`) are embedded in the JWT `realm_access.roles` claim → services use `@PreAuthorize` (Spring) and `[Authorize(Roles = "ADMIN")]` (ASP.NET) based on forwarded `X-User-Roles` header.
6. **Keycloak Event Listener SPI**: A custom Keycloak extension (`RabbitMqEventListenerProvider`) publishes user lifecycle events to RabbitMQ.
7. **Spring JWT feature toggle**: `CINEMA_SECURITY_JWT_ENABLED` flag allows running Spring services without Keycloak during development.
8. **Signed user identity**: In JWT mode, Spring services extract `user_id` from the token and reject spoofed `X-User-*` headers.

---

## 11. Data Consistency & Saga Pattern

### 11.1 The Booking Saga (Most Complex Flow)

The booking flow spans **Showtime Service**, **Booking Service**, and **Payment Service**. A **Choreography-based Saga** maintains consistency:

```
┌────────────────────────────────────────────────────────────────────┐
│                     Booking Saga (Happy Path)                      │
│                                                                    │
│  ┌─────────┐   ┌──────────┐   ┌─────────┐   ┌───────────┐        │
│  │ Showtime│   │ Booking  │   │ Payment │   │Notification│       │
│  │ Service │   │ Service  │   │ Service │   │ Service    │       │
│  └────┬────┘   └────┬─────┘   └────┬────┘   └─────┬─────┘       │
│       │              │              │              │              │
│  1. holdSeats()      │              │              │              │
│  (Redis TTL lock)    │              │              │              │
│       │              │              │              │              │
│       │   2. createOrder()          │              │              │
│       │◄─── validateHeldSeats() ────┤              │              │
│       │──── seats valid ───────────►│              │              │
│       │              │──── order.created ──────────────►           │
│       │              │              │              │              │
│       │   3. processPayment()       │              │              │
│       │              │──── payment ─►│              │              │
│       │              │              │              │              │
│       │   4. confirmSeats()         │              │              │
│       │◄─── confirmHeldSeats() ─────┤              │              │
│       │──── seats BOOKED ──────────►│              │              │
│       │              │              │              │              │
│       │   5. generateTickets()      │              │              │
│       │              │──── order.paid ─────────────────►          │
│       │              │              │              │ send email   │
│       │              │              │              │              │
└────────────────────────────────────────────────────────────────────┘
```

### 11.2 Payment Service Saga State Machine

The Payment Service uses a **MassTransit Saga State Machine** (`PaymentStateMachine`) with EF Core persistence:

| State | Trigger | Action |
|---|---|---|
| Initial → Processing | `OrderPaid` consumed | Gateway factory selects payment provider (Stripe/PayPal/Cash), processes payment |
| Processing → Completed | Payment succeeds | Publish `payment.completed` |
| Processing → Failed | Payment fails | Publish `payment.failed` |
| Completed → Refunding | Refund requested | Process refund via gateway |
| Refunding → Refunded | Refund succeeds | Publish `payment.refunded` |

### 11.3 Compensating Actions (Failure Scenarios)

| Failure Point | Compensation | Triggered By |
|---|---|---|
| Payment fails after order created | Release held seats, cancel order | `payment.failed` event → Booking Service → Showtime Service |
| Seat confirmation fails after payment | Refund payment, cancel order | `seat.confirmation.failed` event → Payment Service |
| Ticket generation fails | Log for manual intervention | Dead-letter queue |
| Notification fails | Retry 3x, then log (non-critical) | DLQ + manual retry |

### 11.4 Idempotency

| Service | Idempotency Mechanism | Details |
|---|---|---|
| Booking Service | Event consumers keyed on `eventId` | Stale transitions ignored, checked-in refunds dead-lettered |
| Payment Service | MassTransit saga correlation + EF Core outbox | `paymentTransactionId` uniqueness |
| Analytics Service | Idempotent event consumers | Reject stale order transitions, retry transient failures, dead-letter permanent failures |
| Recommendation Service | Idempotent event consumers | Same pattern as Analytics |

---

## 12. Observability & Monitoring

### 12.1 Stack

```
┌─────────────────────────────────────────────────────┐
│                 Observability Stack                    │
│          (docker-compose.observability.yml)            │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Metrics  │  │ Logging  │  │ Tracing           │  │
│  │          │  │          │  │                   │  │
│  │Prometheus│  │  Loki    │  │ Grafana Tempo     │  │
│  │   :9090  │  │  :3100   │  │    :3200          │  │
│  └──────┬───┘  └──────┬───┘  └────────┬──────────┘  │
│         │             │               │              │
│         └─────────────┼───────────────┘              │
│                       ▼                              │
│              ┌──────────────┐                        │
│              │   Grafana    │                        │
│              │    :3000     │                        │
│              └──────────────┘                        │
│                       ▲                              │
│                       │                              │
│              ┌──────────────┐                        │
│              │ OpenTelemetry│                        │
│              │  Collector   │                        │
│              │  :4317/:4318 │                        │
│              └──────────────┘                        │
│                                                       │
│  Spring Boot: Micrometer + Actuator + OTLP            │
│  ASP.NET:     OpenTelemetry.NET SDK                   │
│  Keycloak:    OpenTelemetry feature enabled            │
└─────────────────────────────────────────────────────┘
```

### 12.2 OpenTelemetry Instrumentation

| Stack | Instrumentation |
|---|---|
| **Spring Boot** | Micrometer + Spring Boot Actuator + OTLP exporter |
| **ASP.NET Core** | `Shared.Hosting` → `ObservabilityExtensions.cs` registers: ASP.NET Core, HTTP client, EF Core, Redis, Runtime, Process instrumentations → OTLP gRPC exporter |
| **Keycloak** | `KC_FEATURES=opentelemetry` + OTLP endpoint |

### 12.3 Key Metrics per Service

| Metric | Type | Alert Threshold |
|---|---|---|
| `http_request_duration_seconds` | Histogram | p99 > 2s |
| `http_requests_total` | Counter | Error rate > 5% |
| `rabbitmq_messages_published_total` | Counter | Drop to 0 for 5min |
| `rabbitmq_messages_consumed_total` | Counter | Consumer lag > 1000 |
| `db_connection_pool_active` | Gauge | > 80% of max |
| `jvm_memory_used_bytes` / `dotnet_gc_memory_total` | Gauge | > 85% of limit |
| `booking_orders_created_total` | Counter | Business KPI |
| `payment_success_rate` | Gauge | < 95% |

### 12.4 Health Check Endpoints

| Stack | Endpoint | Implementation |
|---|---|---|
| Spring Boot | `/actuator/health` | Spring Boot Actuator (auto-configured) |
| ASP.NET | `/health` | `Microsoft.AspNetCore.Diagnostics.HealthChecks` + custom `HealthChecks/` directory |

---

## 13. Deployment Architecture

### 13.1 Docker Compose (Development)

```yaml
# infrastructure/docker-compose.yml — Full dev stack
services:
  # ── Infrastructure ──────────────────────────────────
  postgres:              # PostgreSQL 18 — single instance, 9 databases
  redis:                 # Redis 7 — general caching (Facility, Gateway)
  rabbitmq:              # RabbitMQ 3.13 — management UI on :15672
  keycloak:              # Keycloak latest — :8080, custom SPI + theme
  neo4j:                 # Neo4j 5.23 Community — :7474/:7687
  mongo:                 # MongoDB 6 — :27017
  showtime-redis:        # Redis 7 — dedicated for seat holds (:6380)

  # ── API Gateway ─────────────────────────────────────
  api-gateway:           # ASP.NET YARP  :5000

  # ── ASP.NET Services ────────────────────────────────
  identity-service:      # :5001
  facility-service:      # :5002
  payment-service:       # :5003
  notification-service:  # :5004

  # ── Spring Boot Services ────────────────────────────
  catalog-service:       # :8081
  showtime-service:      # :8082
  booking-service:       # :8083
  analytics-service:     # :8084
  recommendation-service: # :8085

# Observability (separate file: docker-compose.observability.yml)
  otel-collector:        # :4317/:4318
  prometheus:            # :9090
  tempo:                 # :3200
  loki:                  # :3100
  grafana:               # :3000
```

### 13.2 Docker Compose Network

All services share a single Docker network: `cinema-services`. This enables service-name DNS resolution (e.g., `http://catalog-service:8081`).

### 13.3 Kubernetes (Production)

```
Namespace: cinema-system
├── Deployments
│   ├── api-gateway          (2 replicas, HPA: 2-5)
│   ├── identity-service     (2 replicas, HPA: 2-4)
│   ├── catalog-service      (2 replicas, HPA: 2-3)
│   ├── facility-service     (1 replica,  HPA: 1-2)
│   ├── showtime-service     (3 replicas, HPA: 3-8)  ← Hot path
│   ├── booking-service      (3 replicas, HPA: 3-8)  ← Hot path
│   ├── payment-service      (2 replicas, HPA: 2-4)
│   ├── notification-service (1 replica,  HPA: 1-3)
│   ├── analytics-service    (1 replica,  HPA: 1-2)
│   └── recommendation-svc  (1 replica,  HPA: 1-2)
├── StatefulSets
│   ├── keycloak             (2 nodes, HA with shared DB)
│   ├── postgresql           (3 nodes, primary + 2 replicas)
│   ├── redis                (3 nodes, sentinel)
│   ├── rabbitmq             (3 nodes, cluster)
│   ├── mongodb              (1 node, standalone)
│   └── neo4j               (1 node, community)
├── Services (ClusterIP)
│   └── One per deployment
├── Ingress
│   ├── cinema.example.com → api-gateway
│   └── auth.cinema.example.com → keycloak (admin console, optional)
└── ConfigMaps / Secrets
    └── Per-service configuration + Keycloak realm export
```

---

## 14. Frontend Architecture

### 14.1 Technology Stack

| Component | Technology | Version |
|---|---|---|
| Framework | **React** | 18.3 |
| Build tool | **Vite** | 5.4 |
| Language | **TypeScript** | 5.6 |
| Styling | **TailwindCSS** | 3.4 |
| Auth | **keycloak-js** | 26.2 |
| State management | **Zustand** | 5.0 |
| HTTP client | **Axios** | 1.7 |
| Routing | **React Router DOM** | 6.28 |
| i18n | **i18next** + Browser Language Detector | 26.4 |
| Icons | **Lucide React** | 0.460 |
| Date handling | **Day.js** | 1.11 |
| PDF generation | **jsPDF** + html2canvas | 4.2 |
| QR codes | **qrcode.react** | 4.2 |
| Barcode scanning | **@zxing/browser** | 0.2 |
| Drag-and-drop | **@dnd-kit/core** | 6.3 |

### 14.2 Page Structure

```
frontend/src/pages/
├── Home.tsx               # Landing page
├── Login.tsx              # Keycloak-integrated login
├── SignUp.tsx             # Keycloak-integrated registration
├── ForgotPassword.tsx     # Keycloak password reset
├── AuthCallback.tsx       # OIDC callback handler
├── MovieDetails.tsx       # Movie detail view
├── MovieSearch.tsx        # Movie search/browse
├── MovieShowtimes.tsx     # Showtime selection + seat map
├── EventDetails.tsx       # Event detail view
├── Theaters.tsx           # Cinema/theater listing
├── Membership.tsx         # Membership info
├── HealthCheck.tsx        # Service health dashboard
├── admin/                 # Admin dashboard pages
├── portal/                # User portal (profile, orders, tickets)
└── staff/                 # Staff operations
    └── StaffSettings.tsx  # Staff settings
```

### 14.3 API Service Layer

Frontend communicates with the backend exclusively through the API Gateway. Service modules:

| Service File | Backend Service | Purpose |
|---|---|---|
| `authService.ts` | Keycloak (via Gateway) | Authentication flows |
| `movieService.ts` | Catalog Service | Movie CRUD |
| `eventService.ts` | Catalog Service | Event CRUD |
| `catalogService.ts` | Catalog Service | Catalog browsing |
| `cinemaService.ts` | Facility Service | Cinema listing |
| `showtimeService.ts` | Showtime Service | Showtime queries, seat maps |
| `bookingService.ts` | Booking Service | Order lifecycle |
| `paymentService.ts` | Payment Service | Payment processing |
| `reviewService.ts` | Booking Service | Reviews |
| `recommendationService.ts` | Recommendation Service | Movie recommendations |
| `adminService.ts` | Analytics + multiple | Admin dashboard |
| `staffService.ts` | Booking Service | Staff booking flows |
| `userService.ts` | Identity Service | User profile |

---

## 15. Migration Status & Roadmap

### 15.1 Current Status (as of 2026-09-11)

| Service | Status | Details |
|---|---|---|
| `catalog-service` | ✅ Ready for coordinated migration | Transactional outbox, publisher confirms, MapStruct mappers |
| `showtime-service` | ✅ Ready for coordinated migration | Dedicated Redis, seat locking, internal APIs, inter-service HTTP clients |
| `booking-service` | ✅ Ready for integration | Payment event consumers implemented (`BOOKING_PAYMENT_EVENTS_ENABLED`), outbox pattern |
| `analytics-service` | ✅ Ready for coordinated migration | Event-sourced read model, repeatable backfill |
| `recommendation-service` | ✅ Ready for coordinated migration | Neo4j graph sync, guarded legacy backfill |
| `identity-service` | ✅ Implemented | Clean Architecture, MediatR CQRS, Keycloak sync, user resolution API |
| `facility-service` | ✅ Implemented | Clean Architecture, EF Core migrations, Redis caching, internal APIs, delete guards |
| `payment-service` | ✅ Implemented | MassTransit saga, multiple gateways (Stripe/PayPal/Cash), EF Core outbox |
| `notification-service` | ✅ Implemented | MongoDB, MassTransit consumers, background services |
| `api-gateway` | ✅ Implemented | YARP routing, JWT validation, user ID resolution, health checks |
| **Keycloak** | ✅ Provisioned | Custom SPI, branded theme (login/register/password-reset), realm export, i18n |
| **Observability** | ✅ Provisioned | OTel Collector, Prometheus, Tempo, Loki, Grafana |

### 15.2 Verified Gates

- [x] Spring clean verification: 179 tests, 0 failures, 0 errors
- [x] Six-service Docker build and non-root runtime (`appuser`)
- [x] Runtime and event-flow smoke with automatic teardown
- [x] Fixture migration repeatability, checksum, fingerprint, sequence checks
- [x] Two-cycle audit against local development data (PostgreSQL 18)
- [x] Spring Keycloak resource-server and signed-identity implementation
- [x] Idempotent Booking Saga consumers (unit-tested)

### 15.3 Pending Integration Gates

- [ ] Teammate branches rebased/merged on `refactor-compose-single-postgres`
- [ ] Integrated Keycloak/Gateway security tests with real tokens
- [ ] ASP.NET Facility contract parity and route replacement
- [ ] Payment publishes versioned envelopes to `payment.events` (not MassTransit type exchanges)
- [ ] Frontend production dependency advisories resolved and booking flow tested
- [ ] Canonical copied-snapshot migration with aligned PostgreSQL versions
- [ ] Recommendation graph backfill against canonical snapshot
- [ ] Active Redis hold/final write-delta plan approved
- [ ] Shadow traffic and full end-to-end user/admin/staff flows pass
- [ ] Rollback rehearsal proves return to `backend_legacy` without lost writes

### 15.4 Safe Integration and Cutover Order

1. Push/rebase teammate work from `refactor-compose-single-postgres`
2. Merge Keycloak and Gateway; freeze issuer, audience, roles, claims
3. Enable Spring JWT (`CINEMA_SECURITY_JWT_ENABLED=true`) and pass real-token security suite
4. Integrate ASP.NET Facility — contract + Booking/Showtime dependency tests
5. Point Payment publish topology at `payment.events` and pass Booking consumer matrix
6. Produce one conflict-resolved integrated Compose stack; rerun all smoke tests
7. Canonical PostgreSQL snapshot: guarded export/restore/backfill twice on disposable targets
8. Archive checksums, content/sequence reconciliation, graph/read-model counts
9. Rehearse rollback while `backend_legacy` remains available
10. Schedule write freeze, reconcile Redis seat holds, apply final delta, switch traffic

---

## 16. Risk Assessment

### 16.1 Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| **Data consistency across services** | High | Medium | Saga pattern + idempotent consumers + transactional outbox + compensating actions |
| **Increased latency from network hops** | Medium | High | Response caching at gateway, minimize sync calls, use async where possible |
| **Distributed debugging complexity** | Medium | High | OpenTelemetry + centralized logging (Loki) + distributed tracing (Tempo) + correlation IDs |
| **Database migration data loss** | Critical | Low | Blue-green migration with dual-write period; guarded export/restore/backfill; checksum verification |
| **Polyglot operational complexity** | Medium | Medium | Standardize CI/CD, Docker images, health check patterns; shared `Shared.Hosting` library |
| **Message ordering / duplication** | Medium | Medium | Idempotent consumers + versioned envelopes + schema version checking |
| **Payment↔Booking envelope mismatch** | High | Medium | MassTransit must publish Spring envelope format; freeze JSON field names before merge |
| **Internal auth transitional risk** | Medium | Low | `X-Internal-Token` is stopgap; migrate to client-credentials after integrated baseline |

### 16.2 Organizational Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Team needs both Java and C# expertise | Medium | Start with services closest to team's existing skills; pair programming during ramp-up |
| Increased deployment complexity | Medium | Invest in CI/CD automation early; GitHub Actions workflows exist |
| Higher infrastructure costs | Low | Right-size with HPA; use spot instances for non-critical services |

---

## 17. Recommendation System — Neo4j Graph DB

### 17.1 Overview

The Recommendation Service provides personalized movie suggestions using **collaborative filtering** powered by **Neo4j**, a native graph database. By modeling users, movies, genres, and their relationships as a graph, traversal queries like *"users who watched Movie A also watched Movie B"* become O(relationship-count) operations instead of expensive multi-JOIN SQL queries.

| Attribute | Value |
|---|---|
| **Service Name** | Recommendation Service |
| **Framework** | Spring Boot 3.3 (Java 21) |
| **Database** | Neo4j 5.23 Community |
| **Port** | `8085` |
| **API Prefix** | `/api/recommendations` |
| **Feature Flag** | `RECOMMENDATION_GRAPH_ENABLED` |

### 17.2 Graph Data Model

#### Node Types

| Node Label | Properties | Source Service |
|---|---|---|
| `(:User)` | `userId`, `fullName`, `email`, `gender`, `dateOfBirth` | Identity Service |
| `(:Movie)` | `movieId`, `title`, `ageRating`, `language`, `releaseDate`, `posterUrl`, `active` | Catalog Service |
| `(:Genre)` | `genreId`, `name` | Catalog Service |
| `(:Cinema)` | `cinemaId`, `name`, `location` | Facility Service |

#### Relationship Types

| Relationship | Direction | Properties | Creation Method |
|---|---|---|---|
| `WATCHED` | User → Movie | `orderId`, `bookedAt`, `ticketCount`, `totalPrice` | Event: `order.paid` |
| `RATED` | User → Movie | `rating` (1–5), `reviewId`, `createdAt` | Event: `review.created` / `review.updated` |
| `BELONGS_TO` | Movie → Genre | — | Event: `movie.created` / `movie.updated` |
| `VISITED` | User → Cinema | `visitCount`, `lastVisitedAt` | Computed from `order.paid` chain |
| `PREFERS` | User → Genre | `weight` (0.0–1.0) | Computed nightly batch |
| `SIMILAR_TO` | User ↔ User | `similarityScore` (0.0–1.0) | Computed nightly (Jaccard similarity) |

### 17.3 Recommendation Algorithms

Three tiers, falling through from most to least personalized:

| Tier | Algorithm | When Used | Latency |
|---|---|---|---|
| **Tier 1** — Collaborative Filtering | Graph: users-who-watched-also-watched | User has ≥ 3 bookings | < 50ms |
| **Tier 2** — Content-Based | Genre preference from watch history | User has 1–2 bookings | < 30ms |
| **Tier 3** — Popularity | Top movies by bookings + rating (30 days) | New / anonymous users | < 10ms |

#### Tier 1: Collaborative Filtering (Cypher)

```cypher
MATCH (u:User {userId: $userId})-[:WATCHED]->(m:Movie)<-[:WATCHED]-(other:User)
      -[:WATCHED]->(rec:Movie)
WHERE NOT (u)-[:WATCHED]->(rec) AND rec.active = true
WITH rec, count(DISTINCT other) AS commonUsers,
     avg(CASE WHEN exists((other)-[:RATED]->(rec))
              THEN [(other)-[:RATED]->(rec) | r.rating][0] ELSE 3.0 END) AS avgRating
RETURN rec.movieId, rec.title, rec.posterUrl,
       (commonUsers * 0.6 + avgRating * 0.4) AS relevanceScore
ORDER BY relevanceScore DESC LIMIT $limit
```

### 17.4 API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/recommendations/movies` | ✓ (User) | Personalized recommendations for authenticated user |
| `GET` | `/api/recommendations/movies/popular` | ✗ | Globally popular movies (cold-start / anonymous) |
| `GET` | `/api/recommendations/movies/{movieId}/similar` | ✗ | Movies similar to a specific movie |
| `GET` | `/api/recommendations/users/{userId}/taste-profile` | ✓ (User/Admin) | User's computed taste profile |

### 17.5 Data Synchronization (Event-Driven)

The graph is a **read-optimized projection** populated entirely via RabbitMQ events:

| Event | Source Exchange | Queue | Graph Operation |
|---|---|---|---|
| `order.paid` | `booking.events` | `recommendation.order.paid` | `MERGE (u:User)`, `MERGE (m:Movie)`, `CREATE (u)-[:WATCHED]->(m)` |
| `review.created` | `booking.events` | `recommendation.review.created` | `MERGE (u)-[r:RATED]->(m) SET r.rating = $rating` |
| `review.updated` | `booking.events` | `recommendation.review.updated` | `MATCH (u)-[r:RATED]->(m) SET r.rating = $newRating` |
| `movie.created` | `catalog.events` | `recommendation.movie.created` | `CREATE (m:Movie)`, `CREATE (m)-[:BELONGS_TO]->(g)` |
| `movie.updated` | `catalog.events` | `recommendation.movie.updated` | Update Movie node + re-sync genre edges |
| `user.registered` | `user.events` | `recommendation.user.registered` | `CREATE (u:User {userId, fullName})` |

### 17.6 Nightly Batch Jobs

| Job | Schedule | Purpose |
|---|---|---|
| `SIMILAR_TO` computation | Daily 3:00 AM | Jaccard similarity between users based on shared watched movies (threshold > 0.1) |
| `PREFERS` computation | Daily 3:30 AM | Genre preference weights = user's genre watch count / total watches |

---

## Appendix A: Repository Structure (Actual)

```
cinema-booking-system/
├── backend/
│   ├── pom.xml                              # Maven parent POM (Spring Boot services)
│   ├── MIGRATION_STATUS.md                  # Detailed migration status & cutover gates
│   ├── README.md                            # Backend documentation
│   │
│   ├── services/
│   │   ├── api-gateway/                     # ASP.NET Core 9 — YARP reverse proxy
│   │   │   ├── ApiGateway/
│   │   │   │   ├── Program.cs
│   │   │   │   ├── appsettings.json         # YARP route/cluster config (~10 KB)
│   │   │   │   ├── HealthChecks/
│   │   │   │   └── Middleware/
│   │   │   └── Dockerfile
│   │   │
│   │   ├── identity-service/                # ASP.NET Core 9 — Clean Architecture
│   │   │   ├── IdentityService.slnx
│   │   │   ├── IdentityService.Domain/
│   │   │   ├── IdentityService.Application/
│   │   │   │   └── Features/ (Internal/, KeycloakSync/, Users/)
│   │   │   ├── IdentityService.Infrastructure/
│   │   │   ├── IdentityService.Presentation/
│   │   │   ├── IdentityService.Test/
│   │   │   └── Dockerfile
│   │   │
│   │   ├── facility-service/                # ASP.NET Core 9 — Clean Architecture
│   │   │   ├── FacilityService.slnx
│   │   │   ├── FacilityService.Domain/      # Entities: Cinema, Room, SeatTemplate, SeatType
│   │   │   ├── FacilityService.Application/ # MediatR CQRS: Cinemas/, Rooms/, SeatTemplates/
│   │   │   ├── FacilityService.Infrastructure/ # EF Core, Migrations, Repositories, Redis
│   │   │   ├── FacilityService.Presentation/   # Controllers, ExceptionHandling, ApiResponse
│   │   │   ├── FacilityService.Test/        # Unit + Integration tests
│   │   │   └── Dockerfile
│   │   │
│   │   ├── payment-service/                 # ASP.NET Core 9 — Clean Architecture
│   │   │   ├── PaymentService.slnx
│   │   │   ├── PaymentService.Domain/       # Entities, Enums, Interfaces
│   │   │   ├── PaymentService.Application/  # Commands, IntegrationEvents, Contracts
│   │   │   ├── PaymentService.Infrastructure/ # MassTransit Saga, Gateways (Stripe/PayPal/Cash), EF Core
│   │   │   ├── PaymentService.Presentation/
│   │   │   ├── PaymentService.Test/
│   │   │   └── Dockerfile
│   │   │
│   │   ├── notification-service/            # ASP.NET Core 9 — Clean Architecture
│   │   │   ├── NotificationService.slnx
│   │   │   ├── NotificationService.Domain/  # Entities, Enums, ValueObjects, Interfaces
│   │   │   ├── NotificationService.Application/ # Messages (ConsumedEvents), Features
│   │   │   ├── NotificationService.Infrastructure/ # MongoDB, MassTransit, BackgroundServices
│   │   │   ├── NotificationService.Presentation/
│   │   │   ├── NotificationService.Test/
│   │   │   └── Dockerfile
│   │   │
│   │   ├── catalog-service/                 # Spring Boot 3.3
│   │   │   ├── pom.xml
│   │   │   ├── src/main/java/com/uit/cinema/catalog/
│   │   │   └── Dockerfile
│   │   │
│   │   ├── showtime-service/                # Spring Boot 3.3
│   │   │   ├── pom.xml
│   │   │   ├── src/main/java/com/uit/cinema/showtime/
│   │   │   │   ├── config/ (Redis, Security, Keycloak JWT)
│   │   │   │   ├── controller/ (ShowtimeController, ShowtimeInternalController)
│   │   │   │   ├── service/ (SeatLocking, SeatReservation, Showtime)
│   │   │   │   └── client/ (HttpCatalogReadService, HttpFacilityReadService)
│   │   │   └── Dockerfile
│   │   │
│   │   ├── booking-service/                 # Spring Boot 3.3
│   │   │   ├── pom.xml
│   │   │   ├── src/main/java/com/uit/cinema/booking/
│   │   │   └── Dockerfile
│   │   │
│   │   ├── analytics-service/               # Spring Boot 3.3
│   │   │   ├── pom.xml
│   │   │   ├── src/main/java/com/uit/cinema/analytics/
│   │   │   └── Dockerfile
│   │   │
│   │   └── recommendation-service/          # Spring Boot 3.3
│   │       ├── pom.xml
│   │       ├── src/main/java/com/uit/cinema/recommendation/
│   │       └── Dockerfile
│   │
│   ├── shared/
│   │   ├── Shared.Hosting/                  # .NET shared library (JWT, OTel, InternalApiMiddleware)
│   │   │   └── CinemaBooking.Shared.Hosting.csproj
│   │   ├── contracts/                       # OpenAPI specs per service (8 files)
│   │   └── events/                          # Event schema docs (booking, catalog, payment)
│   │
│   └── infrastructure/
│       ├── docker-compose.yml               # Full dev stack (15 services + 7 infra)
│       ├── docker-compose.observability.yml  # OTel + Prometheus + Tempo + Loki + Grafana
│       ├── .env / .env.example              # Environment configuration
│       ├── init-multiple-databases.sql       # Auto-create 8 PostgreSQL databases
│       ├── keycloak-config/                 # cinema-booking-realm.json (97 KB)
│       ├── keycloak-spi/                    # RabbitMQ Event Listener SPI (Java)
│       ├── keycloak-themes/cinema-theme/    # Custom branded login theme (FTL + i18n)
│       ├── migrations/                      # Export/restore/backfill/rehearsal scripts
│       ├── observability/                   # Prometheus, Tempo, Loki, Grafana, OTel configs
│       ├── smoke-test.ps1                   # Runtime smoke test
│       └── event-flow-smoke.ps1             # Event flow integration test
│
├── backend_legacy/                          # Original monolith — rollback source
│
├── frontend/                                # React + Vite + TailwindCSS + keycloak-js
│   ├── package.json                         # React 18, Vite 5, TypeScript 5.6
│   ├── src/
│   │   ├── pages/                           # 12 pages + admin/ + portal/ + staff/
│   │   ├── services/                        # 14 API service modules
│   │   ├── components/                      # Shared UI components
│   │   ├── contexts/                        # React contexts (auth, theme)
│   │   ├── hooks/                           # Custom hooks
│   │   ├── store/                           # Zustand stores
│   │   ├── types/                           # TypeScript types
│   │   └── i18n.ts                          # Internationalization setup
│   ├── Dockerfile                           # Nginx production build
│   └── nginx.conf                           # Reverse proxy to API Gateway
│
├── docs/
│   ├── architecture.md                      # ← This document
│   ├── authentication_integration_contract.md
│   ├── booking_saga_flow.md
│   ├── cross_service_sync_issues.md
│   ├── frontend_integration_plan.md
│   ├── keycloak_guide.md
│   ├── payment_gateway_flow.md
│   ├── TestPlan.md
│   └── [other documentation]
│
├── docker-compose-app.yml                   # Legacy monolith compose (Postgres 16 + Redis + Spring + React)
│
└── .github/workflows/
    ├── run-build.yml                        # CI build pipeline
    └── run-tests.yml                        # CI test pipeline
```

## Appendix B: Port Allocation

| Service | Internal Port | External (via Gateway) |
|---|---|---|
| API Gateway | 5000 | 443 (HTTPS) / 80 (HTTP) |
| Keycloak | 8080 (HTTP) / 8443 (HTTPS) | — (or via Ingress for admin console) |
| Identity Service | 5001 (→ :80 in container) | — |
| Facility Service | 5002 (→ :80 in container) | — |
| Payment Service | 5003 (→ :80 in container) | — |
| Notification Service | 5004 (→ :80 in container) | — |
| Catalog Service | 8081 | — |
| Showtime Service | 8082 | — |
| Booking Service | 8083 | — |
| Analytics Service | 8084 | — |
| Recommendation Service | 8085 | — |
| PostgreSQL | 5432 | — |
| Redis (general) | 6379 | — |
| Redis (showtime) | 6380 | — |
| RabbitMQ | 5672 (AMQP) / 15672 (UI) | — |
| MongoDB | 27017 | — |
| Neo4j | 7474 (Browser) / 7687 (Bolt) | — |
| Grafana Tempo | 3200 | — |
| Grafana Loki | 3100 | — |
| Grafana | 3000 | — |
| Prometheus | 9090 | — |
| OTel Collector | 4317 (gRPC) / 4318 (HTTP) | — |

## Appendix C: Key Technology Versions

| Technology | Version | Purpose |
|---|---|---|
| Java | 21 (LTS) | Spring Boot services runtime |
| Spring Boot | 3.3.4 | Java microservice framework |
| Maven | 3.x | Java build tool (multi-module) |
| MapStruct | 1.5.5 | Java DTO mapping |
| Lombok | 1.18.34 | Java boilerplate reduction |
| .NET | 9.0 | ASP.NET services runtime |
| ASP.NET Core | 9.0 | C# microservice framework |
| YARP | 2.x | Reverse proxy / API Gateway |
| MediatR | Latest | .NET CQRS mediator |
| MassTransit | 8.x | .NET message bus abstraction (RabbitMQ) |
| Entity Framework Core | 9.0 | .NET ORM |
| OpenTelemetry (.NET) | 1.18.0 | .NET observability SDK |
| **Keycloak** | **latest** | **Centralized IAM — OIDC/OAuth2 provider** |
| **keycloak-js** | **26.2** | **Frontend OIDC client** |
| PostgreSQL | 18 | Primary relational database |
| Redis | 7 | Caching + distributed locks |
| RabbitMQ | 3.13 | Message broker |
| MongoDB | 6 | Notification storage |
| Neo4j | 5.23 Community | Graph database for recommendations |
| React | 18.3 | Frontend framework |
| Vite | 5.4 | Frontend build tool |
| TypeScript | 5.6 | Frontend language |
| TailwindCSS | 3.4 | Frontend styling |
| Docker | 25.x | Containerization |
| Kubernetes | 1.29+ | Container orchestration (production) |

## Appendix D: Future Implementation Notes

### Notification User Preferences
The `notification-service` Domain and Application layers currently support `UserPreference` for channel-based opt-ins (Email, SMS, Push). Future updates must implement:
1. **Infrastructure**: A MongoDB collection to persist `UserPreference` records.
2. **Presentation (API)**: A REST endpoint `PUT /api/notifications/preferences` to allow front-end applications to retrieve and modify user channel opt-ins.

### Analytics ClickHouse Migration
The current Analytics Service uses PostgreSQL for its read model. A future optimization is to migrate to **ClickHouse** for OLAP workloads (columnar storage for fast aggregation queries). This is a performance optimization, not a functional requirement.

### Internal Auth Migration
`X-Internal-Token` is transitional. The target is least-privilege Keycloak client-credentials tokens per calling service. This migration must be done one caller at a time after the integrated Keycloak/Gateway baseline is stable.
