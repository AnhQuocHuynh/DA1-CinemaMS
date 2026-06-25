# Frontend Rules (Tailored)
## Project: Cinema Booking System
## Audience: Frontend Contributors and AI Agents

---

# 1. Purpose
This document tailors the frontend rules for this codebase. It is derived from the broader rules and aligned with the current design guide and project structure.

---

# 2. Stack and Architecture
- SPA with React Router.
- TailwindCSS with existing theme tokens.
- Zustand for shared state.
- shadcn/ui for base components.

Use route-based pages and lazy load heavy routes.

---

# 3. Roles and Access
Guest:
- Browse, search, view showtimes, register/login.

User:
- Book tickets, select seats, apply vouchers, view tickets, request refunds, rate movies.

Staff:
- Ticket check-in via QR, lookup orders, handle near-showtime support.

Admin:
- Manage movies, cinemas, showtimes, seat maps, pricing, users, vouchers, analytics.

---

# 4. Routing Rules
Keep routes under these prefixes:
- Public: `/`, `/login`, `/signup`, `/forgot-password`
- User: `/user/*`
- Admin: `/admin/*`
- Staff: `/staff/*`

Do not introduce new top-level route patterns without updating the docs.

---

# 5. State and Data Flow
Use Zustand stores for:
- Auth state
- Booking state (seat selection, hold timer, checkout summary)
- Ticket detail state

Rules:
- Avoid deep prop drilling.
- Data loading lives in hooks under `src/hooks/`.
- API integration lives in `src/services/apiService.ts`.
- Mock data remains in services with TODO markers for real APIs.

---

# 6. API Integration
- Never hardcode dynamic data in pages.
- Use a centralized API client and attach JWT to protected requests.
- Handle loading and error states consistently.

---

# 7. UI Shells and Components
- Admin pages must use `AdminLayout`.
- Staff pages must use `StaffLayout`.
- User pages must use `PortalTopNav`.
- Reuse `AdminPageHeader`, `AdminTopBar`, `StaffTopBar`, `SeatMapGrid`, `SeatLegend`.

---

# 8. Seat Selection (Critical)
Seat states:
- Available
- Holding
- Sold

Rules:
- Clicking a seat triggers a hold request immediately.
- Hold timer must sync with backend TTL (Redis).
- Release holds on deselect, timeout, leaving page, or cancellation.
- Enforce seat limit (6-8 seats) with a clear message.
- Disable sold and holding seats.
- Near real-time updates via WebSocket, with polling fallback.

Timeout UX:
- Show a modal on expiry: "Session expired".
- Clear local booking state and return to seat selection.

---

# 9. Checkout and Payment
Checkout summary must include:
- Movie, cinema, showtime
- Seats and seat type
- Ticket count
- Voucher discount
- Final total

Payment rules:
- Show remaining hold time.
- Prevent duplicate submissions.
- Handle processing, success, failed, cancelled states.

---

# 10. Tickets and Refunds
My tickets page groups tickets:
- Upcoming
- Used
- Cancelled
- Refunded

Refund button shows only when:
- Ticket unused
- Within policy window

Refund policy:
- >24h: 100%
- 4h-24h: 50%
- <4h: no refund

QR rules:
- Always show QR plus a textual fallback code.

---

# 11. Admin and Staff Rules
Admin:
- CRUD for movies, showtimes, rooms, pricing, users, vouchers.
- Dashboards show revenue, ticket sales, occupancy, trends.

Staff:
- QR check-in page supports camera scan and manual input.
- Ticket lookup by phone, order ID, or ticket code.

---

# 12. UI Design Rules (From Design Guide)
- Use existing color tokens (`primary`, `surface`, `on-surface`, `outline`).
- Avoid new fonts or color tokens without a design update.
- Use rounded card sections with subtle borders and shadows.
- Keep spacing generous and avoid dense tables.
- Motion should be subtle (short `transition-*`).

---

# 13. Error and Loading States
- Use skeletons for major screens.
- Errors must be human readable and actionable.
- Never show raw server errors to users.

---

# 14. Performance and Reliability
- Seat map must remain smooth (consider virtualization if needed).
- Always revalidate seat state before checkout.
- Never mark seats sold before payment success.
- Treat booking completion as atomic (all seats or none).

---

# 15. Deliverables Checklist
Minimum deliverables:
- Auth flow
- Booking flow
- Seat selection with hold timer
- Checkout and success screens
- User tickets with QR
- Admin dashboard and CRUD pages
- Staff check-in and lookup pages
