# Cinema Booking System

> Current runtime and migration handoff: `backend_legacy/` is the complete
> monolith; `backend/` is the microservice target. Extracted Compose uses
> PostgreSQL 18 on `localhost:5432` with logical service databases. Start from
> `../docs/SESSION_BOOTSTRAP.md` and `backend/README.md`, not the Java 17
> layout below.

A **Movie and Event Ticket Booking System** built as a university project. The
original deliverable was a **modular monolith**; the current orientation is
incremental extraction to microservices plus a DevOps pipeline.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 17, Spring Boot 3.3, Maven |
| Database | PostgreSQL 16 |
| Cache / Session | Redis 7 |
| Auth | Spring Security + JWT (jjwt 0.12) |
| Frontend | React 18, Vite 5, TypeScript |
| State Management | Zustand |
| HTTP Client | Axios |
| UI Framework | Tailwind CSS v3, shadcn/ui |
| Icons | Lucide React |

---

## Project Structure

```
cinema-booking-system/
├── backend/                        # Spring Boot application
│   ├── pom.xml
│   └── src/main/
│       ├── java/com/uit/cinema/
│       │   ├── CinemaApplication.java
│       │   ├── controller/         # REST controllers
│       │   ├── service/            # Business logic
│       │   ├── repository/         # Spring Data JPA repositories
│       │   ├── entity/             # JPA entities
│       │   ├── dto/                # Request / Response DTOs
│       │   ├── config/             # Spring configuration beans
│       │   ├── security/           # JWT filters, UserDetailsService
│       │   └── exception/          # Global exception handling
│       └── resources/
│           └── application.yml
└── frontend/                       # React + Vite application
    ├── src/
    │   ├── components/             # Reusable UI components
    │   ├── pages/
    │   │   ├── portal/             # User-facing booking pages
    │   │   ├── admin/              # Admin dashboard pages
    │   │   └── staff/              # Staff management pages
    │   ├── store/                  # Zustand state stores
    │   ├── services/               # Axios API service functions
    │   ├── types/                  # TypeScript interfaces & types
    │   ├── utils/                  # Helper / utility functions
    │   └── hooks/                  # Custom React hooks
    ├── tailwind.config.js
    ├── vite.config.ts
    └── package.json
```

---

## Prerequisites

- **Java 17+** — [Download](https://adoptium.net/)
- **Maven 3.9+** — bundled via `./mvnw`, or install globally
- **PostgreSQL 16** running on `localhost:5432`
- **Redis 7** running on `localhost:6379`
- **Node.js 20 LTS** — [Download](https://nodejs.org/)

---

## Getting Started

### 1. Database Setup

Create the database in PostgreSQL:

```sql
CREATE DATABASE cinema_db;
```

Update credentials in `backend/src/main/resources/application.yml`:

```yaml
spring:
  datasource:
    username: postgres
    password: your_db_password
```

### 2. Start the Backend

```bash
cd backend
./mvnw spring-boot:run
```

The API will be available at `http://localhost:8080`.

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server will be available at `http://localhost:5173`.  
All `/api` requests are automatically proxied to `http://localhost:8080`.

### 4. Add shadcn/ui components (optional, run once)

```bash
cd frontend
npx shadcn-ui@latest init
```

---

## Architecture

```
┌─────────────────────────────────────────┐
│              React Frontend              │
│  (User Portal / Admin Dashboard / Staff) │
└────────────────┬────────────────────────┘
                 │  REST API  /api/**
┌────────────────▼────────────────────────┐
│           Spring Boot Backend            │
│  Controller → Service → Repository      │
│                                         │
│  ┌──────────┐   ┌──────────────────┐   │
│  │ Security │   │  Modules (future) │   │
│  │  (JWT)   │   │  movie / booking  │   │
│  └──────────┘   └──────────────────┘   │
└──────┬───────────────────┬─────────────┘
       │                   │
┌──────▼──────┐   ┌────────▼────────┐
│  PostgreSQL  │   │      Redis      │
│  (main DB)   │   │  (cache/tokens) │
└─────────────┘   └─────────────────┘
```

---

## Environment Variables

Sensitive values that should **not** be committed to git — override via environment variables or a local `application-local.yml`:

| Variable | Description |
|---|---|
| `SPRING_DATASOURCE_PASSWORD` | PostgreSQL password |
| `SPRING_DATA_REDIS_PASSWORD` | Redis password (if set) |
| `APP_JWT_SECRET` | 256-bit Base64 JWT signing key |
