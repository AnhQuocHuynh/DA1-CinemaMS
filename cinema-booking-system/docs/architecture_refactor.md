# Cinema Booking System — Microservices Architecture Refactor

> **Status**: Proposed | **Author**: Senior Engineer | **Date**: 2026-06-26  
> **Current State**: Modular Monolith (Spring Boot 3.3 + PostgreSQL + Redis)  
> **Target State**: Polyglot Microservices (Spring Boot + ASP.NET) with Database-per-Service

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
14. [Migration Roadmap](#14-migration-roadmap)
15. [Risk Assessment](#15-risk-assessment)
16. [Recommendation System — Neo4j Graph DB](#16-recommendation-system--neo4j-graph-db)

---

## 1. Executive Summary

This document proposes refactoring the **Cinema Booking System** from its current **Modular Monolith** into a **polyglot microservices architecture**. The existing Spring Boot application is already organized into well-separated domain modules (`iam`, `catalog`, `booking`, `facility`, `showtime`, `admin`, `staff`, `core`), which provides an excellent foundation for decomposition.

The refactored system will split services between **Spring Boot (Java 21)** and **ASP.NET Core 8 (C#)**, leverage **database-per-service** with purpose-chosen databases, use **RabbitMQ** for async event-driven communication, route all traffic through an **API Gateway**, and adopt **Keycloak** as the centralized Identity & Access Management (IAM) solution — replacing the monolith's custom JWT/auth implementation.

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

### 2.1 Existing Module Structure

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

### 2.2 Current Tech Stack

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

The following cross-module dependencies exist in the monolith and must be resolved during decomposition:

| From Module | To Module | Dependency Type | Details |
|---|---|---|---|
| `booking.OrderServiceImpl` | `showtime.ShowtimeSeatRepository` | **Direct DB access** | Validates seat status, reads seat prices |
| `booking.OrderServiceImpl` | `showtime.SeatHoldPolicy` | **Shared logic** | Builds Redis key to verify seat hold ownership |
| `booking.PaymentServiceImpl` | `showtime.ShowtimeSeatRepository` | **Direct DB access** | Updates seat status HELD → BOOKED |
| `booking.PaymentServiceImpl` | `showtime.ShowtimeRepository` | **Direct DB access** | Reads showtime start time for refund window calc |
| `staff.StaffBookingController` | `booking.dto` | **Shared DTO** | Uses `OrderResponse` from booking module |
| `admin.AdminDashboardServiceImpl` | `booking.*`, `catalog.*`, `iam.*` | **Cross-module queries** | Aggregates data from orders, movies, users |
| All modules | `core.security` | **Shared auth** | JWT filter, `CustomUserDetails`, `@PreAuthorize` |
| All modules | `core.exception` | **Shared exceptions** | `CustomException` class |

---

## 3. Target Microservice Architecture

### 3.1 High-Level Architecture Diagram

```
                          ┌──────────────────────────────────────────────┐
                          │              React Frontend (SPA)            │
                          │   User Portal / Admin Dashboard / Staff UI   │
                          └──────────────────┬───────────────────────────┘
                                             │ HTTPS
                                             ▼
                          ┌──────────────────────────────────────────────┐
                          │           API GATEWAY (YARP)                  │
                          │     ─────────────────────────────────────    │
                          │  • Route Aggregation    • Rate Limiting      │
                          │  • JWT Validation       • Load Balancing     │
                          │    (Keycloak OIDC)      • CORS               │
                          │  • Request/Response Transform                │
                          │  • Circuit Breaker                           │
                          └──┬────┬────┬────┬────┬────┬────┬────┬───────┘
                             │    │    │    │    │    │    │    │
              ┌──────────────┘    │    │    │    │    │    │    └──────────────┐
              │       ┌───────────┘    │    │    │    │    └────────┐         │
              ▼       ▼               ▼    │    ▼    ▼              ▼         ▼
         ┌────────┬────────┐    ┌─────────┐│┌────────┬─────────┐┌────────┬────────┐
         │User    │Catalog │    │Facility │││Showtime│ Booking  ││Payment │Notif.  │
         │Profile │Service │    │Service  │││Service │ Service  ││Service │Service │
         │Service │(Spring │    │(ASP.NET │││(Spring │(Spring   ││(ASP.NET│(ASP.NET│
         │(ASP.NET│ Boot)  │    │ Core)   │││ Boot)  │ Boot)    ││ Core)  │ Core)  │
         └───┬────┴───┬────┘    └───┬─────┘│└───┬────┴───┬─────┘└───┬────┴───┬────┘
             │        │             │      │    │        │          │        │
             ▼        ▼             ▼      │    ▼        ▼          ▼        ▼
         ┌────────┬────────┐   ┌─────────┐ │ ┌────────┬────────┐┌────────┬────────┐
         │Postgres│Postgres│   │Postgres │ │ │Redis + │Postgres││Postgres│  ——    │
         │(usr_db)│(cat_db)│   │(fac_db) │ │ │Postgres│(bkg_db)││(pay_db)│        │
         └────────┴────────┘   └─────────┘ │ └────────┴────────┘└────────┴────────┘
                                           │
                                     ┌─────▼──────────────────────────────────────┐
                                     │         Analytics / Dashboard Service       │
                                     │              (Spring Boot)                  │
                                     │           ┌──────────────┐                  │
                                     │           │ClickHouse/TDB│                  │
                                     │           └──────────────┘                  │
                                     └─────────────────────────────────────────────┘

                                     ┌─────────────────────────────────────────────┐
                                     │         Recommendation Service               │
                                     │              (Spring Boot)                   │
                                     │           ┌──────────────┐                   │
                                     │           │  Neo4j 5.x   │                   │
                                     │           └──────────────┘                   │
                                     └─────────────────────────────────────────────┘

                          ┌──────────────────────────────────────────────┐
                          │         RabbitMQ (Message Broker)             │
                          │   Exchanges: booking.*, payment.*, user.*    │
                          │   seat.*, catalog.*, recommendation.*        │
                          └──────────────────────────────────────────────┘

                          ┌──────────────────────────────────────────────┐
                          │        Shared Infrastructure                  │
                          │  ┌─────────┐  ┌──────┐  ┌────────────────┐  │
                          │  │Keycloak │  │Zipkin│  │ ELK / Grafana  │  │
                          │  │  (IAM)  │  │      │  │ Loki + Prom.   │  │
                          │  │ :8080   │  │(Trace│  │ (Log+Metrics)  │  │
                          │  └─────────┘  └──────┘  └────────────────┘  │
                          │  ┌─────────┐                                │
                          │  │ Consul / │                               │
                          │  │ Eureka   │                               │
                          │  │(Discov.) │                               │
                          │  └─────────┘                                │
                          └──────────────────────────────────────────────┘
```

---

## 4. Service Decomposition

### 4.1 Service Catalog

| # | Service Name | Bounded Context | Responsibility |
|---|---|---|---|
| 1 | **User Profile Service** | User Profile | Extended user profile management (profile fields, preferences), user data synchronization with Keycloak, internal user lookup APIs. Auth (login, registration, JWT, password reset, token management) is handled by **Keycloak** |
| 2 | **Catalog Service** | Catalog | Movie CRUD, Event CRUD, Genre management, catalog search/browse |
| 3 | **Facility Service** | Facility | Cinema management, Room management, Seat template & seat type configuration |
| 4 | **Showtime Service** | Showtime | Showtime scheduling, ShowtimeSeat generation, seat map queries, seat hold/release (Redis TTL) |
| 5 | **Booking Service** | Booking | Order lifecycle (create → pay → refund → cancel), ticket generation, voucher validation & application |
| 6 | **Payment Service** | Payment | Payment processing, transaction management, refund processing, payment gateway integration |
| 7 | **Notification Service** | Notification | Email/SMS/push for booking confirmations, payment receipts, password resets, promotional campaigns |
| 8 | **Analytics Service** | Analytics | Admin dashboard aggregations, revenue series, popular movies, live sales, staff dashboard KPIs |
| 9 | **API Gateway** | Infrastructure | Request routing, auth propagation, rate limiting, circuit breaking |
| 10 | **Recommendation Service** | Recommendation | Personalized movie recommendations via collaborative filtering (Neo4j graph traversal), content-based genre matching, popularity fallback |

### 4.2 Domain Ownership Matrix

| Entity | Owning Service | Consumers (via API/Events) |
|---|---|---|
| `User` (profile data), `KeycloakId` mapping | User Profile Service | All services (user lookup) |
| Auth identity (credentials, roles, tokens, sessions) | **Keycloak** (external) | All services (JWT validation via OIDC) |
| `Movie`, `Event`, `Genre`, `MovieGenre` | Catalog Service | Showtime, Booking, Analytics |
| `Cinema`, `Room`, `SeatTemplate`, `SeatType` | Facility Service | Showtime, Analytics |
| `Showtime`, `ShowtimeSeat` | Showtime Service | Booking, Analytics |
| `Order`, `Ticket`, `Voucher` | Booking Service | Payment, Analytics, Notification |
| `Review` | Booking Service | Catalog (avg rating), Analytics |
| Payment transactions | Payment Service | Booking, Analytics, Notification |
| Recommendation graph (User→Movie edges) | Recommendation Service | Frontend (via API Gateway) |

---

## 5. Technology Assignment — Spring Boot vs ASP.NET

### 5.1 Decision Matrix

| Service | Framework | Language | Rationale |
|---|---|---|---|
| **User Profile Service** | **ASP.NET Core 8** | C# | Lightweight profile management; syncs extended user data with Keycloak; EF Core for profile DB. Auth/JWT/password logic fully delegated to **Keycloak** — no custom JWT middleware needed |
| **Catalog Service** | **Spring Boot 3.3** | Java 21 | Data-heavy CRUD with complex JPA relationships (Movie↔Genre M:N), existing MapStruct mappers; minimal migration effort |
| **Facility Service** | **ASP.NET Core 8** | C# | Relatively simple CRUD, benefits from EF Core's migration system; good candidate for .NET team ramp-up |
| **Showtime Service** | **Spring Boot 3.3** | Java 21 | Complex seat locking logic with Redis (existing implementation), transactional seat reservation with JPA, high concurrency patterns |
| **Booking Service** | **Spring Boot 3.3** | Java 21 | Most complex domain logic (order workflow, voucher calc, ticket generation); heaviest cross-service orchestration; keep close to existing codebase |
| **Payment Service** | **ASP.NET Core 8** | C# | Greenfield service (currently inline in booking); ASP.NET excels at integrating with payment SDKs (.NET has first-class Stripe/VNPay SDKs); strong decimal/money handling |
| **Notification Service** | **ASP.NET Core 8** | C# | Async event-driven; .NET Channels + BackgroundService for email/SMS queues; SignalR for real-time push to admin dashboard |
| **Analytics Service** | **Spring Boot 3.3** | Java 21 | Heavy SQL aggregation queries (existing admin dashboard logic), Spring Data JPA + native queries, potential ClickHouse integration |
| **API Gateway** | **ASP.NET Core 8** | C# | YARP (Yet Another Reverse Proxy) — Microsoft's high-performance, production-grade reverse proxy; native .NET ecosystem |
| **Recommendation Service** | **Spring Boot 3.3** | Java 21 | Spring Data Neo4j has first-class graph DB support; tight integration with existing Spring Boot services; complex Cypher query orchestration |

### 5.2 Summary Split

```
┌─────────────────────────────────┬──────────────────────────────────┐
│     Spring Boot (Java 21)       │      ASP.NET Core 8 (C#)         │
├─────────────────────────────────┼──────────────────────────────────┤
│ • Catalog Service               │ • User Profile Service           │
│ • Showtime Service              │ • Facility Service               │
│ • Booking Service               │ • Payment Service                │
│ • Analytics Service             │ • Notification Service           │
│ • Recommendation Service        │ • API Gateway (YARP)             │
├─────────────────────────────────┼──────────────────────────────────┤
│  5 services                     │  5 services (incl. gateway)      │
└─────────────────────────────────┴──────────────────────────────────┘
```

---

## 6. Database Strategy — Best DB per Service

### 6.1 Database Selection

| Service | Primary Database | Why This DB | Schema/DB Name |
|---|---|---|---|
| **User Profile Service** | **PostgreSQL 16** | User profile data (extended fields, preferences); `keycloak_id` mapping to Keycloak UUID; no auth tokens stored locally | `user_profile_db` |
| **Catalog Service** | **PostgreSQL 16** | Complex M:N relationships (Movie↔Genre), full-text search (`tsvector`), JSONB for flexible metadata | `catalog_db` |
| **Facility Service** | **PostgreSQL 16** | Relational data (Cinema→Room→SeatTemplate), spatial potential (PostGIS for cinema locations) | `facility_db` |
| **Showtime Service** | **PostgreSQL 16** + **Redis 7** | PostgreSQL for showtime/seat persistence; Redis for transient seat holds (TTL-based distributed locks) | `showtime_db` + Redis |
| **Booking Service** | **PostgreSQL 16** | Financial data (orders, amounts), ACID transactions critical for money, audit trail | `booking_db` |
| **Payment Service** | **PostgreSQL 16** | Transactional integrity paramount for payment records; compliance/audit requirements | `payment_db` |
| **Notification Service** | **MongoDB 7** | Schema-flexible for diverse notification templates (email/SMS/push); TTL indexes for auto-expiry of old notifications | `notification_db` |
| **Analytics Service** | **ClickHouse** (primary) + **PostgreSQL** (fallback) | Columnar storage for fast OLAP aggregations (revenue time-series, popular movies); handles billions of rows efficiently | `analytics_db` |
| **Recommendation Service** | **Neo4j 5.x** (graph) + **Redis 7** (cache) | Native graph DB for relationship traversal (collaborative filtering); O(relationship-count) queries vs O(table-size) JOINs; ACID-compliant | `graph_db` |

### 6.2 Caching Strategy

| Service | Cache | Usage |
|---|---|---|
| User Profile Service | **Redis** | User profile cache, rate limit counters |
| Catalog Service | **Redis** | Movie listing cache (TTL 5min), genre list cache |
| Showtime Service | **Redis** | Seat hold locks (TTL-based), seat map cache |
| Booking Service | **Redis** | Order idempotency keys, voucher validation cache |
| API Gateway | **Redis** | Rate limiting counters, response cache |
| Recommendation Service | **Redis** | Personalized recommendation cache (TTL 15min), popular movies cache (TTL 1h), taste profile cache (TTL 24h) |

### 6.3 Database Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PostgreSQL Cluster                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │identity  │ │catalog   │ │facility  │ │showtime  │ │booking   │ │
│  │ profile  │ │  _db     │ │  _db     │ │  _db     │ │  _db     │ │
│  │  _db     │ │          │ │          │ │          │ │          │ │
│  │          │ │• movies  │ │• cinemas │ │• show-   │ │• orders  │ │
│  │• users   │ │• events  │ │• rooms   │ │  times   │ │• tickets │ │
│  │• keycloak│ │• genres  │ │• seat_   │ │• show-   │ │• vouchers│ │
│  │  _id map │ │• movie_  │ │  templates│ │  time_  │ │• reviews │ │
│  │          │ │  genres  │ │• seat_   │ │  seats   │ │          │ │
│  │          │ │          │ │  types   │ │          │ │          │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                                     │
│  ┌──────────┐                                                       │
│  │payment   │                                                       │
│  │  _db     │                                                       │
│  │• payments│                                                       │
│  │• txn_log │                                                       │
│  └──────────┘                                                       │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐  ┌──────────────────┐  ┌──────────────┐
│  Redis 7     │  │  MongoDB 7       │  │ ClickHouse   │
│              │  │                  │  │              │
│• seat_holds  │  │• notification_db │  │• analytics_db│
│• token_black │  │  └ notifications │  │  └ orders_mv │
│• rate_limits │  │  └ templates     │  │  └ revenue   │
│• cache       │  │  └ delivery_log  │  │  └ events    │
│• rec_cache   │  │                  │  │              │
└──────────────┘  └──────────────────┘  └──────────────┘

┌──────────────┐
│  Neo4j 5.x   │
│              │
│• graph_db    │
│  └ users     │
│  └ movies    │
│  └ genres    │
│  └ WATCHED   │
│  └ RATED     │
│  └ SIMILAR_TO│
└──────────────┘
```

---

## 7. API Gateway & Routing

### 7.1 Gateway Technology: **YARP (ASP.NET Core)**

[YARP](https://microsoft.github.io/reverse-proxy/) (Yet Another Reverse Proxy) is chosen for:
- Native .NET integration with the ASP.NET middleware pipeline
- High performance (~500K+ RPS on commodity hardware)
- Dynamic route configuration (hot-reload from config/DB)
- Built-in load balancing, health checks, and session affinity

### 7.2 Route Table

| Route Pattern | Target Service | Method | Auth Required | Rate Limit |
|---|---|---|---|---|
| `/api/auth/**` | Keycloak `:8080` | ALL | ✗ | 20 req/min |
| `/api/users/**` | User Profile Service `:5001` | ALL | ✓ | 60 req/min |
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
| `/api/recommendations/movies` | Recommendation Service `:8085` | GET | ✓ | 60 req/min |
| `/api/recommendations/movies/popular` | Recommendation Service `:8085` | GET | ✗ | 120 req/min |
| `/api/recommendations/movies/*/similar` | Recommendation Service `:8085` | GET | ✗ | 60 req/min |

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
│  │ CORS        │  │ Request    │  │ Response              │ │
│  │ Handling    │  │ Logging    │  │ Aggregation           │ │
│  └─────────────┘  └────────────┘  └───────────────────────┘ │
│           │                                │                 │
│           ▼                                ▼                 │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Route → Upstream Service                   │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 7.4 YARP Configuration Example

```json
{
  "ReverseProxy": {
    "Routes": {
      "keycloak-route": {
        "ClusterId": "keycloak-cluster",
        "Match": { "Path": "/api/auth/{**catch-all}" }
      },
      "catalog-route": {
        "ClusterId": "catalog-cluster",
        "Match": { "Path": "/api/movies/{**catch-all}" }
      },
      "showtime-route": {
        "ClusterId": "showtime-cluster",
        "Match": { "Path": "/api/showtimes/{**catch-all}" }
      },
      "booking-route": {
        "ClusterId": "booking-cluster",
        "Match": { "Path": "/api/orders/{**catch-all}" },
        "AuthorizationPolicy": "authenticated"
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
      "catalog-cluster": {
        "Destinations": {
          "catalog-1": { "Address": "http://catalog-service:8081" }
        },
        "HealthCheck": {
          "Active": { "Enabled": true, "Interval": "00:00:10", "Path": "/actuator/health" }
        }
      },
      "showtime-cluster": {
        "Destinations": {
          "showtime-1": { "Address": "http://showtime-service:8082" }
        }
      },
      "booking-cluster": {
        "Destinations": {
          "booking-1": { "Address": "http://booking-service:8083" }
        }
      }
    }
  }
}
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
| Analytics Service | Catalog Service | `GET /internal/movies/{id}` | Enrich analytics with movie titles |
| Analytics Service | User Profile Service | `GET /internal/users/count` | Get total user count for dashboard |
| API Gateway | User Profile Service | `GET /internal/users/resolve?keycloakId={uuid}` | Resolve Keycloak UUID → internal Long user ID (cached) |

> **Note**: All internal APIs use the `/internal/` prefix and are blocked at the API Gateway level (not exposed externally). Services authenticate internally via API key header (`X-Internal-Api-Key`).

### 8.3 Asynchronous Events (RabbitMQ)

#### Message Broker: **RabbitMQ 3.13**

**Why RabbitMQ over Kafka?**
- Better fit for command/event patterns at this scale (thousands, not millions, of events/sec)
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

#### Event Payload Examples

**`order.paid`**
```json
{
  "eventId": "uuid-v4",
  "eventType": "order.paid",
  "timestamp": "2026-06-26T12:00:00Z",
  "payload": {
    "orderId": 1234,
    "userId": 42,
    "showtimeId": 567,
    "totalAmount": 450000.00,
    "finalAmount": 405000.00,
    "ticketCount": 3,
    "paymentMethod": "CREDIT_CARD",
    "transactionId": "TXN-123456789"
  }
}
```

**`user.registered`**
```json
{
  "eventId": "uuid-v4",
  "eventType": "user.registered",
  "timestamp": "2026-06-26T12:00:00Z",
  "payload": {
    "userId": 42,
    "email": "user@example.com",
    "fullName": "John Doe"
  }
}
```

### 8.4 Library Choices

| Stack | Async Messaging Library | HTTP Client |
|---|---|---|
| Spring Boot | **Spring AMQP** (`spring-boot-starter-amqp`) | **Spring WebClient** (reactive) or **RestClient** (blocking) with Resilience4j |
| ASP.NET Core | **MassTransit** (over RabbitMQ transport) | **HttpClientFactory** with Polly retry/circuit-breaker |

---

## 9. Shared Infrastructure Services

### 9.1 Service Discovery

| Option | Technology | Notes |
|---|---|---|
| **Option A** (Recommended for Docker/K8s) | **Kubernetes DNS** or **Docker Compose service names** | Zero-config; services resolve via `http://catalog-service:8081` |
| **Option B** (VM deployment) | **Consul** | Service registry + health checks + KV store |

### 9.2 Configuration Management

| Stack | Technology |
|---|---|
| Spring Boot services | **Spring Cloud Config Server** (Git-backed) |
| ASP.NET services | **Azure App Configuration** or shared config via **Consul KV** |
| Secrets | **HashiCorp Vault** or Docker Secrets |

### 9.3 Centralized Logging

```
Services → Fluentd/Filebeat → Elasticsearch → Kibana
                                     or
Services → Promtail → Loki → Grafana
```

### 9.4 Distributed Tracing

| Component | Technology |
|---|---|
| Trace propagation | **OpenTelemetry SDK** (both Java and .NET) |
| Trace backend | **Zipkin** or **Jaeger** |
| Correlation | W3C Trace Context headers (`traceparent`, `tracestate`) |

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
                   User Profile Service cache                     │
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
| Internal Service Token | API Gateway | Auto-generated, header-injected | Per-request |

### 10.4 User ID Resolution Strategy

The legacy system uses `Long` IDs for users. Keycloak uses `UUID` strings. To maintain backward compatibility:

1. **User Profile Service** maintains a `users` table with both `id` (internal `Long`, auto-increment) and `keycloak_id` (UUID, unique)
2. When a user registers (via Keycloak), a Keycloak Event Listener SPI publishes a `user.registered` event to RabbitMQ
3. The User Profile Service consumes this event and creates a local user record with the `keycloak_id` mapping
4. The **API Gateway** resolves `sub` (UUID) → `X-User-Id` (Long) via a cached lookup to the User Profile Service's `/internal/users/resolve?keycloakId={uuid}` endpoint
5. Downstream services continue using `Long` user IDs — no migration needed for `Order.userId`, `Payment.userId`, etc.

### 10.5 Keycloak Realm Configuration

| Setting | Value |
|---|---|
| Realm name | `cinema-booking` |
| Login theme | Custom branded theme |
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

1. **Keycloak as single source of truth for auth**: No microservice stores passwords, issues tokens, or manages sessions. This eliminates custom JWT code and reduces the attack surface.
2. **RS256 asymmetric signing**: Keycloak signs JWTs with its private key; all services validate using Keycloak's JWKS endpoint (`/realms/cinema-booking/protocol/openid-connect/certs`). No shared secret distribution.
3. **Token revocation**: Keycloak handles token revocation via its built-in revocation endpoint. No Redis-based token blacklist needed.
4. **Internal APIs**: Protected via network-level isolation (Docker internal network) + API key header (`X-Internal-Api-Key`). Internal routes are blocked at the API Gateway.
5. **RBAC**: Keycloak realm roles (`ADMIN`, `STAFF`, `CUSTOMER`) are embedded in the JWT `realm_access.roles` claim → services use `@PreAuthorize` (Spring) and `[Authorize(Roles = "ADMIN")]` (ASP.NET) based on forwarded `X-User-Roles` header.
6. **Keycloak Event Listener SPI**: A custom Keycloak extension publishes user lifecycle events (`user.registered`, `user.password.reset`) to RabbitMQ, enabling the Notification Service and Recommendation Service to react to auth events without polling.

---

## 11. Data Consistency & Saga Pattern

### 11.1 The Booking Saga (Most Complex Flow)

The booking flow spans **Showtime Service**, **Booking Service**, and **Payment Service**. We use a **Choreography-based Saga** to maintain consistency:

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

### 11.2 Compensating Actions (Failure Scenarios)

| Failure Point | Compensation | Triggered By |
|---|---|---|
| Payment fails after order created | Release held seats, cancel order | `payment.failed` event → Booking Service → Showtime Service |
| Seat confirmation fails after payment | Refund payment, cancel order | `seat.confirmation.failed` event → Payment Service |
| Ticket generation fails | Log for manual intervention (order stays PAID, tickets generated async) | Dead-letter queue |
| Notification fails | Retry 3x, then log (non-critical) | DLQ + manual retry |

### 11.3 Idempotency

| Service | Idempotency Key | Storage |
|---|---|---|
| Booking Service | `{userId}:{showtimeId}:{sortedSeatIds}` | Redis (TTL 5 min) |
| Payment Service | `paymentTransactionId` | PostgreSQL unique constraint |

---

## 12. Observability & Monitoring

### 12.1 Stack

```
┌─────────────────────────────────────────────────────┐
│                 Observability Stack                    │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Metrics  │  │ Logging  │  │ Tracing           │  │
│  │          │  │          │  │                   │  │
│  │Prometheus│  │  Loki    │  │ Zipkin / Jaeger   │  │
│  │    +     │  │    +     │  │       +           │  │
│  │ Grafana  │  │ Grafana  │  │   OpenTelemetry   │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│                                                       │
│  Spring Boot: Micrometer + Actuator                   │
│  ASP.NET:     OpenTelemetry.NET + health checks       │
└─────────────────────────────────────────────────────┘
```

### 12.2 Key Metrics per Service

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

### 12.3 Health Check Endpoints

| Stack | Endpoint | Implementation |
|---|---|---|
| Spring Boot | `/actuator/health` | Spring Boot Actuator (auto-configured) |
| ASP.NET | `/health` | `Microsoft.AspNetCore.Diagnostics.HealthChecks` |

---

## 13. Deployment Architecture

### 13.1 Docker Compose (Development / Staging)

```yaml
# Simplified overview of target docker-compose.yml
services:
  # ── Infrastructure ──────────────────────────────────
  postgres:          # Shared PostgreSQL instance (dev only, separate in prod)
  redis:
  rabbitmq:
  neo4j:
  zipkin:
  keycloak:          # Keycloak IAM  :8080 (console) / :8443 (HTTPS)
    depends_on: [postgres]

  # ── API Gateway ─────────────────────────────────────
  api-gateway:       # ASP.NET YARP  :5000
    depends_on: [keycloak, user-profile-service, catalog-service, ...]

  # ── ASP.NET Services ────────────────────────────────
  user-profile-service:  # :5001 (formerly identity-service)
  facility-service:  # :5002
  payment-service:   # :5003
  notification-service: # :5004

  # ── Spring Boot Services ────────────────────────────
  catalog-service:   # :8081
  showtime-service:  # :8082
  booking-service:   # :8083
  analytics-service: # :8084
  recommendation-service: # :8085

  # ── Frontend ────────────────────────────────────────
  frontend:          # Nginx :80 → proxies /api → api-gateway:5000
```

### 13.2 Kubernetes (Production)

```
Namespace: cinema-system
├── Deployments
│   ├── api-gateway          (2 replicas, HPA: 2-5)
│   ├── user-profile-service (2 replicas, HPA: 2-4)
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
│   ├── clickhouse           (1 node, single shard)
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

## 14. Migration Roadmap

### Phase 0: Preparation (Week 1-2)

| Task | Details |
|---|---|
| Set up monorepo structure | Create `services/` directory with sub-projects |
| Provision infrastructure | RabbitMQ, additional PostgreSQL databases, Docker network |
| **Deploy Keycloak** | **Set up Keycloak instance, create `cinema-booking` realm, configure clients (`cinema-frontend`, `cinema-api-gateway`), define realm roles (`ADMIN`, `STAFF`, `CUSTOMER`), configure default role, enable self-registration, set up SMTP for password reset emails** |
| **Build Keycloak Event Listener SPI** | **Create custom Keycloak extension JAR that publishes `user.registered` and `user.password.reset` events to RabbitMQ** |
| Set up CI/CD pipelines | Per-service build + deploy pipelines |
| Define shared contracts | Create shared proto/OpenAPI contract library for internal APIs |
| Establish observability | Deploy Prometheus + Grafana + Zipkin stack |

### Phase 1: Extract User Profile Service (Week 3-4) — ASP.NET

| Task | Details |
|---|---|
| Create ASP.NET User Profile Service | Extract user profile data from `iam` module: `User` entity (profile fields only, no auth). Add `keycloak_id` (UUID) column for Keycloak mapping |
| Migrate `user_profile_db` | Extract users table (without `password_hash`, `refresh_tokens`, `password_reset_tokens` — these are in Keycloak) |
| Implement user ID resolution API | `GET /internal/users/resolve?keycloakId={uuid}` → returns internal `Long` ID |
| Consume Keycloak events | Listen for `user.registered` from Keycloak SPI → create local user profile record |
| Backfill Keycloak users | Migrate existing users from PostgreSQL to Keycloak realm (one-time script) |
| Deploy API Gateway (YARP) | Route `/api/auth/**` to Keycloak; `/api/users/**` to User Profile Service; configure JWT validation against Keycloak OIDC |

### Phase 2: Extract Catalog Service (Week 5-6) — Spring Boot

| Task | Details |
|---|---|
| Create Spring Boot Catalog Service | Extract `catalog` module as standalone service |
| Migrate `catalog_db` | Movies, events, genres tables |
| Publish catalog events | `movie.created`, `movie.updated` to RabbitMQ |
| Update gateway routes | `/api/movies/**`, `/api/events/**`, `/api/genres/**` |

### Phase 3: Extract Facility Service (Week 7-8) — ASP.NET

| Task | Details |
|---|---|
| Create ASP.NET Facility Service | Rewrite `facility` module: Cinema, Room, SeatTemplate, SeatType |
| Migrate `facility_db` | Cinemas, rooms, seat_templates, seat_types |
| Expose internal API | `GET /internal/rooms/{id}/seats` for Showtime Service |
| Update gateway routes | `/api/cinemas/**` |

### Phase 4: Extract Showtime Service (Week 9-11) — Spring Boot

| Task | Details |
|---|---|
| Create Spring Boot Showtime Service | Extract `showtime` module with Redis seat locking |
| Migrate `showtime_db` | Showtimes, showtime_seats |
| Expose internal seat APIs | `/internal/seats/validate`, `/internal/seats/confirm`, `/internal/seats/release` |
| Integrate with Facility Service | Fetch room/seat templates via REST |
| Update gateway routes | `/api/showtimes/**` |

### Phase 5: Extract Booking + Payment Services (Week 12-15) — Spring Boot + ASP.NET

| Task | Details |
|---|---|
| Create Spring Boot Booking Service | Extract `booking` module: Order, Ticket, Voucher, Review |
| Create ASP.NET Payment Service | **New service** extracted from `PaymentServiceImpl` |
| Implement Booking Saga | Choreography-based saga with RabbitMQ events |
| Replace direct DB calls | Booking → Showtime via REST; Payment events via RabbitMQ |
| Migrate `booking_db` + `payment_db` | Split data |

### Phase 6: Add Notification + Analytics Services (Week 16-18) — ASP.NET + Spring Boot

| Task | Details |
|---|---|
| Create ASP.NET Notification Service | Consume events, send emails/SMS |
| Create Spring Boot Analytics Service | Migrate `admin` + `staff` dashboard logic |
| Set up ClickHouse | Ingest order/payment events for OLAP queries |
| Wire up all remaining events | Full event mesh operational |

### Phase 7: Decommission Monolith (Week 19-20)

| Task | Details |
|---|---|
| Traffic migration | Shift 100% traffic through API Gateway |
| Remove monolith routes | All `/api/**` served by microservices |
| Archive monolith code | Keep for reference, mark as deprecated |
| Final testing | End-to-end integration tests across all services |

```
Week  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18 19 20
      ├──┤                                                           Phase 0: Prep + Keycloak
         ├─────┤                                                     Phase 1: User Profile (ASP.NET)
               ├─────┤                                               Phase 2: Catalog (Spring)
                     ├─────┤                                         Phase 3: Facility (ASP.NET)
                           ├────────┤                                Phase 4: Showtime (Spring)
                                    ├───────────┤                    Phase 5: Booking+Payment
                                                ├────────┤           Phase 6: Notification+Analytics
                                                         ├─────┤    Phase 7: Decommission
```

---

## 15. Risk Assessment

### 15.1 Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| **Data consistency across services** | High | Medium | Saga pattern + idempotency keys + compensating actions |
| **Increased latency from network hops** | Medium | High | Response caching at gateway, minimize sync calls, use async where possible |
| **Distributed debugging complexity** | Medium | High | OpenTelemetry + centralized logging + correlation IDs |
| **Database migration data loss** | Critical | Low | Blue-green migration with dual-write period; extensive backup strategy |
| **Polyglot operational complexity** | Medium | Medium | Standardize CI/CD, Docker images, health check patterns across both stacks |
| **Message ordering / duplication** | Medium | Medium | Idempotent consumers + message deduplication at consumer level |
| **Service discovery failures** | High | Low | Docker/K8s DNS (reliable), health checks with automatic de-registration |

### 15.2 Organizational Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Team needs both Java and C# expertise | Medium | Start with services closest to team's existing skills; pair programming during ramp-up |
| Increased deployment complexity | Medium | Invest in CI/CD automation early (Phase 0) |
| Higher infrastructure costs | Low | Right-size with HPA; use spot instances for non-critical services |

---

## 16. Recommendation System — Neo4j Graph DB

### 16.1 Overview

The Recommendation Service provides personalized movie suggestions using **collaborative filtering** powered by **Neo4j**, a native graph database. By modeling users, movies, genres, and their relationships as a graph, traversal queries like *"users who watched Movie A also watched Movie B"* become O(relationship-count) operations instead of expensive multi-JOIN SQL queries.

| Attribute | Value |
|---|---|
| **Service Name** | Recommendation Service |
| **Framework** | Spring Boot 3.3 (Java 21) |
| **Database** | Neo4j 5.x (graph) + Redis 7 (cache) |
| **Port** | `8085` |
| **API Prefix** | `/api/recommendations` |

```
                   Relational (PostgreSQL)                 Graph (Neo4j)
                   ─────────────────────                   ──────────────
  "Users like me   SELECT DISTINCT m2.*                    MATCH (u:User)-[:WATCHED]->(m:Movie)
   also watched"   FROM orders o1                                <-[:WATCHED]-(similar:User)
                   JOIN showtimes s1 ON ...                      -[:WATCHED]->(rec:Movie)
                   JOIN orders o2 ON ...                    WHERE u.id = $userId
                   JOIN showtimes s2 ON ...                 AND NOT (u)-[:WATCHED]->(rec)
                   JOIN movies m2 ON ...                    RETURN rec, count(similar) AS score
                   WHERE o1.user_id = ?                     ORDER BY score DESC
                   AND o2.user_id != ?
                   AND m2.id NOT IN (...)                   → 1 query, ~5ms on millions of nodes
                   → 5+ JOINs, ~500ms+ at scale
```

### 16.2 Graph Data Model

#### Node Types

| Node Label | Properties | Source Service |
|---|---|---|
| `(:User)` | `userId`, `fullName`, `email`, `gender`, `dateOfBirth` | User Profile Service |
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

#### Graph Visualization

```
         ┌──────┐   WATCHED    ┌──────────────┐   BELONGS_TO   ┌─────────┐
         │User A├─────────────►│ Inception    ├───────────────►│ Sci-Fi  │
         └──┬───┘              └──────┬───────┘                └────┬────┘
            │                         │                              │
            │ RATED(5)                │ WATCHED                     │
            │                         │                              │
         ┌──▼───┐                  ┌──▼───┐                         │
         │Inter-│◄─────────────────│User B│                         │
         │stellar│   WATCHED       └──┬───┘                         │
         └──────┘                     │ WATCHED                     │
                                      ▼                              │
                                 ┌────────┐   BELONGS_TO            │
                                 │  Dune  ├─────────────────────────┘
                                 └────────┘
                                      ▲
                            RECOMMEND to User A
                      (User B watched it, shares taste)
```

### 16.3 Recommendation Algorithms

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

#### Tier 2: Content-Based (Genre Preference)

```cypher
MATCH (u:User {userId: $userId})-[:WATCHED]->(m:Movie)-[:BELONGS_TO]->(g:Genre)
WITH u, g, count(m) AS genreWatchCount ORDER BY genreWatchCount DESC LIMIT 5
MATCH (rec:Movie)-[:BELONGS_TO]->(g)
WHERE NOT (u)-[:WATCHED]->(rec) AND rec.active = true
RETURN rec.movieId, rec.title, collect(DISTINCT g.name) AS matchedGenres,
       sum(genreWatchCount) AS genreRelevance
ORDER BY genreRelevance DESC LIMIT $limit
```

#### Tier 3: Popularity Fallback

```cypher
MATCH (m:Movie)<-[w:WATCHED]-()
WHERE w.bookedAt > datetime() - duration('P30D') AND m.active = true
WITH m, count(w) AS bookingCount
OPTIONAL MATCH ()-[r:RATED]->(m)
RETURN m.movieId, m.title, bookingCount, coalesce(avg(r.rating), 0) AS avgRating,
       (bookingCount * 0.7 + coalesce(avg(r.rating), 0) * 0.3) AS popularityScore
ORDER BY popularityScore DESC LIMIT $limit
```

### 16.4 API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/recommendations/movies` | ✓ (User) | Personalized recommendations for authenticated user |
| `GET` | `/api/recommendations/movies/popular` | ✗ | Globally popular movies (cold-start / anonymous) |
| `GET` | `/api/recommendations/movies/{movieId}/similar` | ✗ | Movies similar to a specific movie |
| `GET` | `/api/recommendations/users/{userId}/taste-profile` | ✓ (User/Admin) | User's computed taste profile |

#### Response Schema

```json
{
  "userId": 42,
  "algorithm": "COLLABORATIVE_FILTERING",
  "recommendations": [
    {
      "movieId": 15,
      "title": "Dune: Part Two",
      "posterUrl": "https://cloudinary.com/...",
      "relevanceScore": 8.7,
      "reason": "87% of users who watched 'Inception' also watched this",
      "matchedGenres": ["Sci-Fi", "Adventure"],
      "avgRating": 4.5,
      "bookingCount": 234
    }
  ],
  "metadata": {
    "totalCandidates": 47,
    "processingTimeMs": 23,
    "fallbackUsed": false
  }
}
```

### 16.5 Data Synchronization (Event-Driven)

The graph is a **read-optimized projection** populated entirely via RabbitMQ events — no direct DB access to other services:

| Event | Source Exchange | Queue | Graph Operation |
|---|---|---|---|
| `order.paid` | `booking.events` | `recommendation.order.paid` | `MERGE (u:User)`, `MERGE (m:Movie)`, `CREATE (u)-[:WATCHED]->(m)` |
| `review.created` | `booking.events` | `recommendation.review.created` | `MERGE (u)-[r:RATED]->(m) SET r.rating = $rating` |
| `review.updated` | `booking.events` | `recommendation.review.updated` | `MATCH (u)-[r:RATED]->(m) SET r.rating = $newRating` |
| `movie.created` | `catalog.events` | `recommendation.movie.created` | `CREATE (m:Movie)`, `CREATE (m)-[:BELONGS_TO]->(g)` |
| `movie.updated` | `catalog.events` | `recommendation.movie.updated` | Update Movie node + re-sync genre edges |
| `user.registered` | `user.events` | `recommendation.user.registered` | `CREATE (u:User {userId, fullName})` |

> **Note**: The `order.paid` event should be enriched with `movieId` at the source (resolved from `showtimeId`) to avoid synchronous calls from the Recommendation Service to the Showtime Service.

### 16.6 Nightly Batch Jobs

| Job | Schedule | Purpose |
|---|---|---|
| `SIMILAR_TO` computation | Daily 3:00 AM | Jaccard similarity between users based on shared watched movies (threshold > 0.1) |
| `PREFERS` computation | Daily 3:30 AM | Genre preference weights = user's genre watch count / total watches |

#### Jaccard Similarity (Cypher)

```cypher
MATCH (u1:User)-[:WATCHED]->(m:Movie)<-[:WATCHED]-(u2:User)
WHERE u1.userId < u2.userId
WITH u1, u2, count(m) AS intersection
MATCH (u1)-[:WATCHED]->(m1:Movie)
WITH u1, u2, intersection, count(DISTINCT m1) AS u1Movies
MATCH (u2)-[:WATCHED]->(m2:Movie)
WITH u1, u2, intersection, u1Movies, count(DISTINCT m2) AS u2Movies
WITH u1, u2, toFloat(intersection) / (u1Movies + u2Movies - intersection) AS jaccard
WHERE jaccard > 0.1
MERGE (u1)-[s:SIMILAR_TO]-(u2)
SET s.score = jaccard, s.computedAt = datetime()
```

### 16.7 Caching Strategy

| Data | Cache Key | TTL | Invalidation |
|---|---|---|---|
| Personalized recommendations | `rec:user:{userId}` | 15 min | On new `order.paid` or `review.created` for that user |
| Popular movies | `rec:popular` | 1 hour | Scheduled refresh |
| Similar movies | `rec:similar:{movieId}` | 6 hours | On `movie.updated` event |
| User taste profile | `rec:taste:{userId}` | 24 hours | Recomputed nightly |

### 16.8 Neo4j Schema & Indexes

```cypher
-- Uniqueness constraints
CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.userId IS UNIQUE;
CREATE CONSTRAINT movie_id_unique IF NOT EXISTS FOR (m:Movie) REQUIRE m.movieId IS UNIQUE;
CREATE CONSTRAINT genre_id_unique IF NOT EXISTS FOR (g:Genre) REQUIRE g.genreId IS UNIQUE;
CREATE CONSTRAINT cinema_id_unique IF NOT EXISTS FOR (c:Cinema) REQUIRE c.cinemaId IS UNIQUE;

-- Performance indexes
CREATE INDEX movie_active IF NOT EXISTS FOR (m:Movie) ON (m.active);
CREATE INDEX watched_bookedAt IF NOT EXISTS FOR ()-[w:WATCHED]-() ON (w.bookedAt);
```

### 16.9 Service Package Structure

```
services/recommendation-service/
├── pom.xml
├── Dockerfile
└── src/main/java/com/uit/cinema/recommendation/
    ├── RecommendationServiceApplication.java
    ├── config/
    │   ├── Neo4jConfig.java
    │   ├── RedisConfig.java
    │   └── RabbitMqConfig.java
    ├── controller/
    │   └── RecommendationController.java
    ├── service/
    │   ├── RecommendationService.java
    │   ├── CollaborativeFilteringService.java
    │   ├── ContentBasedService.java
    │   ├── PopularityService.java
    │   └── GraphSyncService.java
    ├── consumer/
    │   ├── OrderEventConsumer.java
    │   ├── ReviewEventConsumer.java
    │   ├── MovieEventConsumer.java
    │   └── UserEventConsumer.java
    ├── repository/
    │   ├── UserGraphRepository.java
    │   ├── MovieGraphRepository.java
    │   └── RecommendationQueryRepository.java
    ├── dto/
    │   ├── RecommendationResponse.java
    │   ├── MovieRecommendation.java
    │   └── events/
    │       ├── OrderPaidEvent.java
    │       ├── ReviewEvent.java
    │       ├── MovieEvent.java
    │       └── UserRegisteredEvent.java
    ├── model/
    │   ├── UserNode.java
    │   ├── MovieNode.java
    │   ├── GenreNode.java
    │   ├── CinemaNode.java
    │   └── relationships/
    │       ├── WatchedRelationship.java
    │       └── RatedRelationship.java
    └── scheduler/
        └── SimilarityComputeScheduler.java
```

### 16.10 Dependencies

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-neo4j</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-redis</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-cache</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-amqp</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-actuator</artifactId>
    </dependency>
</dependencies>
```

### 16.11 Docker Compose Addition

```yaml
neo4j:
  image: neo4j:5-community
  container_name: cinema-neo4j
  environment:
    NEO4J_AUTH: neo4j/cinema_graph_2026
    NEO4J_PLUGINS: '["apoc"]'
    NEO4J_dbms_memory_heap_max__size: 512m
    NEO4J_dbms_memory_pagecache_size: 256m
  ports:
    - "7474:7474"
    - "7687:7687"
  volumes:
    - neo4j_data:/data
  healthcheck:
    test: ["CMD-SHELL", "cypher-shell -u neo4j -p cinema_graph_2026 'RETURN 1'"]
    interval: 15s
    timeout: 10s
    retries: 5
  networks:
    - cinema-network

recommendation-service:
  build:
    context: ./services/recommendation-service
    dockerfile: Dockerfile
  container_name: cinema-recommendation
  ports:
    - "8085:8085"
  environment:
    - SPRING_NEO4J_URI=bolt://neo4j:7687
    - SPRING_NEO4J_AUTHENTICATION_USERNAME=neo4j
    - SPRING_NEO4J_AUTHENTICATION_PASSWORD=cinema_graph_2026
    - SPRING_DATA_REDIS_HOST=redis
    - SPRING_RABBITMQ_HOST=rabbitmq
  depends_on:
    neo4j:
      condition: service_healthy
    redis:
      condition: service_healthy
  networks:
    - cinema-network
```

### 16.12 Initial Data Backfill

When deploying for the first time, the empty graph requires a one-time backfill from PostgreSQL:

1. Query all existing Users → create `(:User)` nodes
2. Query all Movies + Genres → create `(:Movie)`, `(:Genre)`, `[:BELONGS_TO]` edges
3. Query all PAID Orders + Showtimes → create `[:WATCHED]` edges
4. Query all Reviews → create `[:RATED]` edges
5. Run initial similarity computation

```bash
java -jar recommendation-service.jar --backfill
```

---

## Appendix A: Repository Structure (Target)

```
cinema-booking-system/
├── services/
│   ├── api-gateway/                    # ASP.NET YARP
│   │   ├── ApiGateway.csproj
│   │   ├── Program.cs
│   │   ├── appsettings.json
│   │   └── Dockerfile
│   │
│   ├── identity-service/              # ASP.NET Core (User Profile)
│   │   ├── IdentityService.csproj
│   │   ├── Controllers/
│   │   ├── Models/
│   │   ├── Services/
│   │   ├── Data/
│   │   └── Dockerfile
│   │
│   ├── catalog-service/               # Spring Boot
│   │   ├── pom.xml
│   │   ├── src/main/java/com/uit/cinema/catalog/
│   │   └── Dockerfile
│   │
│   ├── facility-service/              # ASP.NET Core
│   │   ├── FacilityService.csproj
│   │   └── Dockerfile
│   │
│   ├── showtime-service/              # Spring Boot
│   │   ├── pom.xml
│   │   ├── src/main/java/com/uit/cinema/showtime/
│   │   └── Dockerfile
│   │
│   ├── booking-service/               # Spring Boot
│   │   ├── pom.xml
│   │   ├── src/main/java/com/uit/cinema/booking/
│   │   └── Dockerfile
│   │
│   ├── payment-service/               # ASP.NET Core
│   │   ├── PaymentService.csproj
│   │   └── Dockerfile
│   │
│   ├── notification-service/          # ASP.NET Core
│   │   ├── NotificationService.csproj
│   │   └── Dockerfile
│   │
│   ├── analytics-service/             # Spring Boot
│   │   ├── pom.xml
│   │   └── Dockerfile
│   │
│   └── recommendation-service/        # Spring Boot (NEW)
│       ├── pom.xml
│       └── Dockerfile
│
├── shared/
│   ├── contracts/                     # Shared OpenAPI specs / proto files
│   ├── events/                        # Event schema definitions (JSON Schema)
│   └── docker/                        # Shared Docker configs
│
├── infrastructure/
│   ├── docker-compose.yml             # Full development stack
│   ├── docker-compose.infra.yml       # Infrastructure only
│   └── k8s/                           # Kubernetes manifests
│       ├── namespaces/
│       ├── deployments/
│       ├── services/
│       ├── configmaps/
│       └── ingress/
│
├── frontend/                          # React + Vite (unchanged)
│   └── ...
│
└── docs/
    ├── architecture_refactor.md       # This document
    ├── api-contracts/                 # Per-service OpenAPI specs
    └── runbooks/                      # Operational runbooks
```

## Appendix B: Port Allocation

| Service | Internal Port | External (via Gateway) |
|---|---|---|
| API Gateway | 5000 | 443 (HTTPS) / 80 (HTTP) |
| Keycloak | 8080 (HTTP) / 8443 (HTTPS) | — (or via Ingress for admin console) |
| User Profile Service | 5001 | — |
| Facility Service | 5002 | — |
| Payment Service | 5003 | — |
| Notification Service | 5004 | — |
| Catalog Service | 8081 | — |
| Showtime Service | 8082 | — |
| Booking Service | 8083 | — |
| Analytics Service | 8084 | — |
| Recommendation Service | 8085 | — |
| PostgreSQL | 5432 | — |
| Redis | 6379 | — |
| RabbitMQ | 5672 (AMQP) / 15672 (UI) | — |
| ClickHouse | 8123 (HTTP) / 9000 (native) | — |
| Neo4j | 7474 (Browser) / 7687 (Bolt) | — |
| Zipkin | 9411 | — |
| Grafana | 3000 | — |
| Prometheus | 9090 | — |

## Appendix C: Key Technology Versions

| Technology | Version | Purpose |
|---|---|---|
| Java | 21 (LTS) | Spring Boot services runtime |
| Spring Boot | 3.3.x | Java microservice framework |
| Spring Cloud | 2023.0.x | Config, circuit breaker, gateway patterns |
| .NET | 8.0 (LTS) | ASP.NET services runtime |
| ASP.NET Core | 8.0 | C# microservice framework |
| YARP | 2.1.x | Reverse proxy / API Gateway |
| **Keycloak** | **25.x** | **Centralized IAM — OIDC/OAuth2 provider, user management, SSO** |
| MassTransit | 8.x | .NET message bus abstraction (RabbitMQ) |
| Entity Framework Core | 8.0 | .NET ORM |
| PostgreSQL | 16 | Primary relational database |
| Redis | 7.x | Caching + distributed locks |
| RabbitMQ | 3.13 | Message broker |
| MongoDB | 7.0 | Notification storage |
| ClickHouse | 24.x | Analytics OLAP database |
| Neo4j | 5.x | Graph database for recommendations |
| Spring Data Neo4j | 7.x | Java ORM for Neo4j |
| Docker | 25.x | Containerization |
| Kubernetes | 1.29+ | Container orchestration (production) |
| OpenTelemetry | 1.x | Distributed tracing SDK |
| Prometheus | 2.x | Metrics collection |
| Grafana | 10.x | Dashboards & visualization |
