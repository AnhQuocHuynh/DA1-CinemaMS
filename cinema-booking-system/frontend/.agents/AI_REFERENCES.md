# AI References

## What was added
- Admin UI pages: dashboard, movie management, permissions, pricing and vouchers, room management, showtime management.
- Staff UI pages: ticket lookup and QR checker.
- User booking flow pages: seat booking, checkout, checkout success, ticket info.
- Reusable layout components: admin layout/top bar/page header, staff layout/top bar/sidebar, portal top nav, seat map grid and legend.
- Hooks for admin, staff, booking, checkout, and ticket detail data.
- Booking store (Zustand) for seat selection.

## Important patterns
- Services in `src/services/apiService.ts` hold mock data and include TODO comments for real API calls.
- Hooks in `src/hooks/` use the services and are the single place for page data loading.
- Admin and staff pages wrap content with `AdminLayout` or `StaffLayout` for consistent shell.
- User booking uses `useSeatSelection` and `SeatMapGrid` + `SeatLegend` components.

## Quick route map
- `/admin/dashboard`, `/admin/movies`, `/admin/permissions`, `/admin/pricing`, `/admin/rooms`, `/admin/showtimes`
- `/staff/dashboard`, `/staff/ticket-lookup`, `/staff/qr-checker`
- `/user/dashboard`, `/user/booking`, `/user/checkout`, `/user/checkout-success`, `/user/tickets/:ticketId`

## Mock data locations
- Admin, staff, booking mocks: `src/services/apiService.ts`
- Booking store: `src/store/bookingStore.ts`

## UI design guide
- Keep UI consistency rules in [frontend/docs/UI_DESIGN_GUIDE.md](frontend/docs/UI_DESIGN_GUIDE.md).
- Tailored frontend rules live in [frontend/docs/FE_RULES.md](frontend/docs/FE_RULES.md).
- API contract with backend live in [frontend/docs/API_DOCS.md](frontend/docs/API_DOCS.md).

## Notes for future work
- The booking seat map is mock-generated and does not use showtime params yet.
- The checkout success page uses static booking IDs and should connect to a real checkout response.
- Ticket info uses `ticketId` route param but mock data ignores it for now.
