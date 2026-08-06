# AGENTS.md

Durable rules for agents working in this repository.

## Session Startup
- Read `AGENTS.md` and `docs/SESSION_BOOTSTRAP.md` first.
- Before reading implementation files, run `git status --short --branch` and `git log --oneline --decorate --max-count=8`.
- Use the `Task-To-Files` table in `docs/SESSION_BOOTSTRAP.md` to select only the contract, module, and tests needed for the current task.
- Do not scan the whole repository or read all of `architecture_refactor.md` by default. Read `docs/CONTEXT.md`, `docs/CURRENT_STATE.md`, and detailed contracts only when the bootstrap routes the task there.
- `cinema-booking-system/backend/MIGRATION_STATUS.md` is the current source for migration evidence, blockers, and cutover gates.
- If documentation and targeted code disagree, inspect the narrow implementation and report the mismatch instead of expanding the scan without a reason.

## Repository Scope
- Workspace root: `D:\UNI_DOCS\HK6\DA1\DA1-CinemaMS`.
- Main project directory: `cinema-booking-system/`.
- Current branch at handoff: `refactor-n-decoupling`.
- Treat `cinema-booking-system/backend_legacy/` as the complete runnable backend unless the user explicitly asks to continue the microservice refactor under `cinema-booking-system/backend/`.
- `cinema-booking-system/backend/` contains extracted Spring Boot `catalog-service`, `facility-service`, `showtime-service`, `booking-service`, `analytics-service`, and `recommendation-service` slices. It is not yet a complete replacement for `backend_legacy`.
- Per `cinema-booking-system/docs/architecture_refactor.md`, do not expand services assigned to ASP.NET in this Spring Boot workstream: `identity-service`, target `facility-service`, `payment-service`, `notification-service`, and `api-gateway`. The current Spring Boot `facility-service` is a compatibility slice from earlier extraction work; keep further changes minimal and contract-driven.

## Collaboration Rules
- Do not commit unless the user explicitly asks.
- Never revert user or teammate changes without explicit approval.
- If unexpected git changes appear, stop and ask before modifying them.
- Prefer `rg`/`rg --files` for search.
- Prefer `apply_patch` for focused file edits.
- Keep Markdown handoff docs concise and factual.

## Backend Rules
- Runnable backend path: `cinema-booking-system/backend_legacy/`.
- Java version: 21. Maven project: `backend_legacy/pom.xml`.
- Backend modules live under `backend_legacy/src/main/java/com/uit/cinema/`: `core`, `iam`, `catalog`, `facility`, `showtime`, `booking`, `admin`, `staff`.
- Use DTOs and MapStruct mappers where they already exist; keep controllers thin and business rules in services.
- Database defaults are in `backend_legacy/src/main/resources/application.yml`: PostgreSQL `localhost:5432/cinema_db`, user `postgres`, password `123`; Redis `localhost:6379`.
- JWT secret in `backend_legacy/src/main/resources/application.yml` now has a valid Base64 default while still allowing `APP_JWT_SECRET` override.
- Existing manual DB patch: `backend_legacy/src/main/resources/DB_PATCH_2026_06_24_STAFF_BOOKING.sql`.
- A seat-map patch may be needed if an existing DB lacks `seat_templates.pathway`; see `docs/CURRENT_STATE.md`.

## Frontend Rules
- Frontend path: `cinema-booking-system/frontend/`.
- Stack: React 18, Vite 5, TypeScript, Zustand, Axios, Tailwind CSS.
- API base is proxied to backend in Vite; dev server defaults to `http://localhost:5173`.
- Keep FE API calls aligned with backend `/api/**` contracts and `frontend/docs/API_DOCS.md`.

## Commands
- Backend tests: `cd cinema-booking-system/backend_legacy; mvn test`.
- Extracted services: `cd cinema-booking-system/backend; mvn clean verify`.
- Backend run: `cd cinema-booking-system/backend_legacy; mvn spring-boot:run`.
- Frontend install/build: `cd cinema-booking-system/frontend; npm ci; npm run build`.
- Frontend dev: `cd cinema-booking-system/frontend; npm run dev`.
- Full legacy app Docker compose file exists at `cinema-booking-system/docker-compose-app.yml` but references `./backend`, while the runnable backend is currently under `backend_legacy`; verify before using.
- Extracted service compose: `cd cinema-booking-system/backend; docker compose -f infrastructure/docker-compose.yml config`.

## Known Pitfalls
- `backend/target/` may contain generated classes from extracted service builds and should not be treated as source of truth.
- `backend_legacy/application.yml` comments show encoding mojibake; avoid broad reformatting unless requested.
- Full Docker may conflict with manually started `my-postgres` or `cinema-redis` containers on ports `5432`/`6379`.
- Frontend `npm run lint` may fail if ESLint 9 config is missing; build is the stronger current verification target.
