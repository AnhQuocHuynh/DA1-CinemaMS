# TODOs

## Front-end readiness and connectivity
- Align frontend services with the "Frontend Integration Alignment (May 2026 snapshot)" section in API docs (routes, data shapes, token storage, ApiResponse unwrap).
- Replace mocked services with real API calls; remove TODO-commented axios blocks after wiring.
- Fix endpoint mismatches: `/auth/signup` -> `/auth/register`, `/showtimes?movieId` -> `/showtimes/movie/{movieId}`, `/bookings` -> `/orders`, `/tickets/{ticketId}` -> `/tickets/code/{ticketCode}` or `/tickets/orders/{orderId}`.
- Remove `/admin/*` and `/staff/*` API assumptions or map them to actual backend routes.
- Update auth handling: store `accessToken` + `refreshToken`, parse `ApiResponse` login payload, and handle refresh flow via `/auth/refresh`.
- Ensure all ApiResponse-wrapped endpoints unwrap `data`, while raw endpoints (`/orders`, `/tickets`, `/vouchers`, `/reviews`) are consumed directly.
- Add a per-flow readiness checklist (Login/Auth, Booking, Admin CRUD, Staff CRUD, Portal) with status: UI ready, API wired, guards enabled.
- Booking: connect showtime -> seat map -> hold -> checkout -> ticket generation; verify end-to-end navigation using real IDs.
- Auth/login: confirm API login + token handling; re-enable `ProtectedRoute` once stable; verify role-based routing.
- Admin/Staff CRUD: replace mock data with endpoints; confirm create/update/delete flows, pagination, and server-side filters.
- Portal browsing: sync movie IDs and showtime params across `Home`, `MovieDetails`, `MovieSearch`, and checkout.
- Align booking flow with `FE_RULES.md` (seat hold TTL sync, timeout UX, duplicate payment prevention).
- Add loading/error/empty states for all data-driven screens to make API readiness explicit.

## UI follow-ups
- Align existing user pages (`Home`, `MovieDetails`, `MovieSearch`) with final mockups if needed.
- Consider loading skeletons for dashboards and booking screens.
- Review FE rules against current UI shells and layout usage.

## Tech debt
- Validate `SeatMapGrid` data when service returns real seat categories.
- Add tests for hooks and store behavior (seat selection, checkout summary, auth flow).
- Ensure consistent date/time formatting across admin/staff/portal pages.
