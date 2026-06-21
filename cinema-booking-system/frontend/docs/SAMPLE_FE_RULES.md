# Frontend Requirements & UI Business Rules
## Project: Online Movie / Event Ticket Booking System
## Target Audience: AI Agents / Frontend Developers

---

# 1. Project Overview

This frontend system is a SPA (Single Page Application) for an online movie/event booking platform.

Frontend stack:
- ReactJS
- TailwindCSS
- Zustand
- shadcn/ui

The frontend communicates with backend REST APIs.

Core goals:
- Fast booking flow
- Real-time seat updates
- Prevent double booking
- Responsive UI
- Clear role-based interfaces

---

# 2. Main Roles

## 2.1 Guest
Can:
- Browse movies/events
- Search/filter
- View showtimes
- Register/Login

Cannot:
- Purchase tickets
- Access personal tickets

---

## 2.2 Customer (User)
Can:
- Book tickets
- Select seats
- Apply vouchers
- View owned tickets
- Refund eligible tickets
- Rate movies/events

---

## 2.3 Staff
Can:
- Check-in tickets via QR scan
- Lookup tickets/orders
- Print tickets
- Handle special support cases

Special rule:
- Staff booking flow may allow booking near showtime.

---

## 2.4 Admin
Can:
- Manage movies/events
- Manage cinemas
- Manage showtimes
- Configure seat maps
- Manage pricing
- Manage users
- View analytics/reports
- Configure refund policy
- Manage vouchers

---

# 3. Frontend Architecture Rules

## 3.1 SPA Architecture
Use:
- React Router
- Route-based pages
- Lazy loading for heavy pages

---

## 3.2 State Management

Use Zustand stores for:
- Authentication
- Seat selection
- Booking session
- User tickets
- Payment state
- Theme/UI state

Avoid:
- Deep prop drilling

---

## 3.3 API Rules

Frontend must:
- Never hardcode data
- Fetch all dynamic content from APIs
- Handle loading/error states consistently

Use:
- Axios or Fetch wrapper
- Centralized API client
- JWT interceptor

---

# 4. Authentication & Authorization

## 4.1 JWT Handling

Frontend must:
- Store access token securely
- Attach token to protected requests
- Auto logout on token expiration

---

## 4.2 Route Protection

Protected routes:
- `/profile`
- `/my-tickets`
- `/checkout`
- `/admin/*`
- `/staff/*`

---

## 4.3 Role-based UI

Frontend MUST hide unauthorized UI elements.

Examples:
- User should not see admin sidebar
- Staff should not access analytics pages

IMPORTANT:
UI hiding does NOT replace backend authorization.

---

# 5. Required Pages

---

## 5.1 Home Page

Features:
- Hero/banner
- Trending movies/events
- Upcoming movies/events
- Search bar
- Category filters
- Cinema/location shortcuts

Business rules:
- Hot/trending items prioritized
- Ongoing items shown before upcoming
- Expired events hidden

---

## 5.2 Search & Listing Page

Features:
- Search by:
  - movie name
  - event name
  - actor
  - location
- Filters:
  - genre
  - cinema
  - showtime
  - status
- Infinite scroll or pagination

Business rules:
- Support Vietnamese with and without accents
- Empty state required
- Search should feel real-time

---

## 5.3 Movie/Event Detail Page

Must display:
- Poster
- Trailer
- Description
- Cast
- Duration
- Rating
- Community reviews
- Quick review summary

Actions:
- Book ticket
- Rate movie/event

---

## 5.4 Showtime Selection Page

Flow:
1. Select date
2. Select cinema
3. Select showtime

Business rules:
- Hide expired showtimes
- Disable sold-out showtimes
- Disable nearly started showtimes for normal users
- Staff may still access nearly-started sessions

Recommended UI:
- Group by cinema
- Group by format (2D, 3D, IMAX)

---

# 6. Seat Selection Page (CRITICAL)

This is the MOST IMPORTANT frontend page.

---

## 6.1 Seat Status Colors

Frontend must visually distinguish:

| State | Meaning |
|---|---|
| Empty | Available |
| Selected | Current user selected |
| Holding | Locked by another user |
| Sold | Purchased |

IMPORTANT:
States must update in near real-time.

---

## 6.2 Seat Interaction Rules

User can:
- Select available seats
- Unselect owned selections

User cannot:
- Select sold seats
- Select holding seats

---

## 6.3 Seat Holding Logic

When user selects a seat:
- Frontend sends hold request immediately
- Backend locks seat via Redis

Frontend MUST:
- Start countdown timer
- Sync timer with backend TTL
- Release seats on:
  - manual deselect
  - timeout
  - leaving page
  - booking cancellation

---

## 6.4 Seat Limits

Business rule:
- Maximum 6-8 seats per booking

Frontend must:
- Prevent exceeding limit
- Show validation message

---

## 6.5 Real-time Seat Updates

Frontend SHOULD use:
- WebSocket
OR
- Polling fallback

Required updates:
- Seat sold
- Seat held
- Seat released

---

## 6.6 Timeout UX

If hold expires:
- Show modal:
  "Session expired"
- Redirect back to seat selection
- Clear local booking state

---

# 7. Checkout & Payment

---

## 7.1 Checkout Summary

Must display:
- Movie/event
- Cinema
- Showtime
- Seats
- Seat type
- Ticket count
- Voucher discount
- Final total

---

## 7.2 Countdown Timer

Payment page MUST show:
- Remaining hold time

Business rule:
- Timer synchronized with Redis TTL

---

## 7.3 Voucher UX

Features:
- Input voucher code
- Apply/remove voucher
- Live total recalculation

Handle:
- invalid voucher
- expired voucher
- already used voucher

---

## 7.4 Payment States

Frontend must support:
- processing
- success
- failed
- cancelled

Prevent:
- duplicate submissions
- double payment clicks

---

# 8. User Ticket Management

## 8.1 My Tickets Page

Group tickets:
- Upcoming
- Used
- Cancelled
- Refunded

Each ticket shows:
- QR code
- Showtime
- Seat
- Order ID

---

## 8.2 Refund Rules

Frontend should only show refund button if:
- ticket unused
- refund window valid

Refund policy:
- >24h → 100%
- 4h–24h → 50%
- <4h → no refund

---

## 8.3 QR Code Rules

QR must:
- Be unique
- Be readable on mobile
- Support fullscreen mode

Fallback:
- Show textual ticket code

---

# 9. Review & Rating Features

## 9.1 Rating Rules

User can only rate if:
- purchased ticket exists

Features:
- 1–5 stars
- comment text
- edit existing review

---

## 9.2 Comment Summary Section

Display:
- Positive/negative ratio
- Keyword cloud
- AI-generated summary

Business rules:
- Do not censor valid negative feedback
- Hide only toxic/inappropriate content

---

# 10. Staff Features

## 10.1 QR Check-in Page

Features:
- Camera scanner
- Manual code input
- Ticket validation status

Possible states:
- valid
- already used
- invalid
- refunded

---

## 10.2 Ticket Lookup

Search by:
- phone number
- order ID
- ticket code

---

# 11. Admin Features

---

## 11.1 Dashboard

Display:
- Revenue
- Ticket sales
- Occupancy rate
- Trending movies/events

Charts:
- Revenue over time
- Popular showtimes
- Seat occupancy

---

## 11.2 Movie/Event CRUD

Required:
- Create
- Edit
- Delete
- Upload poster/banner

---

## 11.3 Seat Configuration

Admin can:
- Configure rows/columns
- Configure seat types
- Configure pricing multipliers

---

## 11.4 Dynamic Pricing

Frontend must support:
- different prices by:
  - seat type
  - holiday
  - showtime
  - event

---

## 11.5 User Management

Features:
- Lock/unlock account
- Assign roles
- View activity history

---

# 12. UI/UX Requirements

---

## 12.1 Responsive Design

Must support:
- Desktop
- Tablet
- Mobile

Seat map responsiveness is REQUIRED.

---

## 12.2 Booking Flow Limit

Business rule:
Booking process should not exceed 5 major steps.

Recommended flow:
1. Browse
2. Select showtime
3. Select seats
4. Checkout
5. Success

---

## 12.3 Error Handling

Errors must be:
- human readable
- actionable

Examples:
- "This seat was just selected by another user"
- "Session expired"
- "Payment failed"

Avoid:
- raw server errors

---

## 12.4 Loading States

Required:
- skeleton loaders
- button loading states
- optimistic UI where safe

---

## 12.5 Accessibility

Recommended:
- keyboard navigation
- screen-reader labels
- sufficient contrast

---

# 13. Performance Requirements

Frontend targets:
- Initial load optimized
- Search response under 2 seconds
- Smooth seat map interaction

Recommended:
- lazy image loading
- route splitting
- memoization
- virtualization for large seat maps

---

# 14. Real-time System Rules

Frontend must assume:
- seat data can change anytime

Never trust stale local state.

Always:
- validate seat state before checkout
- refresh seat status when reconnecting

---

# 15. Important Business Constraints

## NEVER:
- Assume seat ownership locally
- Mark seat sold before payment success
- Trust frontend-only validation
- Allow duplicate payment submissions

---

## ALWAYS:
- Sync with backend state
- Respect Redis TTL
- Handle race conditions gracefully
- Keep UI responsive during network delays

---

# 16. Recommended Component Structure

Suggested modules:
- Auth
- Movies
- Events
- Cinemas
- Showtimes
- SeatMap
- Booking
- Checkout
- Tickets
- Reviews
- Admin
- Staff

Reusable components:
- SeatButton
- CountdownTimer
- QRDisplay
- PaymentStatus
- VoucherInput
- ReviewCard
- MovieCard

---

# 17. Recommended Frontend Enhancements

Optional improvements:
- Dark mode
- PWA support
- Push notifications
- Offline ticket caching
- Animated seat transitions
- Real-time occupancy heatmap

---

# 18. Critical Technical Notes

## Concurrency
Seat conflicts are EXPECTED behavior.

Frontend must gracefully handle:
- seat conflicts
- expired sessions
- partial failures

---

## Redis Holding
Frontend countdown is NOT source of truth.

Backend Redis TTL is authoritative.

---

## Atomic Booking
Booking completion should be treated as atomic:
- either all seats booked
- or none booked

Frontend must handle rollback responses correctly.

---

# 19. Expected Frontend Deliverables

Minimum deliverables:
- Responsive SPA
- Authentication flow
- Seat booking flow
- Checkout flow
- QR ticket system
- Admin dashboard
- Staff check-in interface

---

# 20. Recommended API Integration Areas

Frontend should expect APIs for:
- auth
- movies
- events
- cinemas
- showtimes
- seats
- bookings
- payments
- vouchers
- tickets
- reviews
- analytics
- admin management

---

# 21. Final Notes

The seat booking flow is the highest priority area.

Main frontend priorities:
1. Real-time seat synchronization
2. Preventing inconsistent UI state
3. Fast and smooth UX
4. Clear feedback during booking/payment
5. Strong responsive behavior