# Development Roadmap

Updated: 2026-10-11. Branch under inspection: `refactor-compose-single-postgres`.

This file is the plan for features still in development. It is not a claim that
the work is implemented. Current behavior stays in `CURRENT_STATE.md`.

Instructor feedback added on 2026-10-11:

1. Search by movie content.
2. Private room-rental flow. The backend already exists on `feature/room-rental`.
3. A report that describes and analyzes the supplementary features.
4. A responsive layout that works on mobile.

## Order

Do these in order. Each phase ends with the tests named in that phase. Do not
merge `feature/room-rental` or `fix-payment-vulnerability` as a whole branch.

1. Content search in Catalog and the search page.
2. Port the rental service onto this branch, then add the missing UI.
3. Write the analysis report and surface the rental report in admin.
4. Responsive pass on the booking, staff, and admin screens.

`fix-payment-vulnerability` is a separate payment-authority change. Rental
payment must use a server-computed amount. Do not send a price from the browser.

## 1. Content search

### What exists

`MovieRepository.searchMovies` already matches `title` or `description` with
`LIKE`. `GET /api/catalog/search` returns that page. `MovieSearch.tsx` calls it.

### Gap

The match is a substring, not content search. Word order matters, Vietnamese
text without diacritics misses, and the page does not say whether the hit was
the title or the plot. Home suggestions still mix in mock movies.

### Plan

1. Keep the current `keyword` parameter. Add a PostgreSQL `simple` text-search
   query over `title`, `description`, and genre names. Rank a title match above
   a plot match. Keep `LIKE` only as a fallback for a one-token query that
   full-text would drop.
2. Extend the search response with `matchedIn` (`title` or `description`) and a
   short `snippet` from the description.
3. On `MovieSearch.tsx`, show the snippet and a "matched in plot" label when
   `matchedIn` is `description`.
4. Remove the mock-movie block and mock suggestions from `Home.tsx`.
5. Add a Catalog test where the keyword appears only in `description`, and one
   where a title hit ranks first.

Do not add an embedding model in this phase.

## 2. Room rental

### What exists

`origin/feature/room-rental` at `4b03fb8` adds a Spring `rental-service`:

- `POST /api/rentals/quote` prices a window from the room hourly rate.
- `POST /api/rentals` creates a request.
- Approve, reject, pay, and cancel endpoints.
- `GET /api/rentals/report` for an admin or manager.
- Showtime calls `hasBlockingRental` before creating a showtime in that window.
- Tests: `RentalServiceTest`, plus a Showtime guard test.

That branch is not an ancestor of the current tip. Its diff also touches
Identity cinema assignments, gateway routes, and Keycloak. Merging it would
overwrite newer payment, notification, and frontend work.

There is no rental page in the frontend on either branch.

### Plan

1. Copy `services/rental-service` and `shared/contracts/rental-service.openapi.yml`
   from `4b03fb8`. Add the module to `backend/pom.xml`.
2. Bring over only the Showtime rental-slot guard and its test. Reapply that
   diff by hand onto the current `ShowtimeServiceImpl`.
3. Add gateway routes for `/api/rentals/**`. Public quote can be anonymous.
   Create, pay, and cancel require the signed user. Approve, reject, report,
   and rate changes require admin or staff.
4. Add `cinema_rental_db` to `init-multiple-databases.sql` and a Compose
   service on a free host port. Point it at Facility and Showtime with
   `X-Internal-Token`.
5. Build the UI after the API is on this branch:
   - Customer: quote, submit, my rentals.
   - Admin: pending list, approve, reject, hourly rate, report.
6. Payment: the quote total is computed on the server. The pay call sends the
   rental id and method only. Wire it through payment-service the same way as
   an order, using the amount stored on the rental. Do not accept an amount
   from the client.
7. Run `mvn test` in `rental-service` and the Showtime module, then one Compose
   check that a rental window blocks a new showtime.

Identity cinema-manager assignments from that branch stay out of the first
port. Admin and staff are enough until a manager role is specified.

## 3. Supplementary-feature report

This is a written analysis, plus one admin screen for the rental numbers.
It is not a new analytics service.

### Document

Add `docs/SUPPLEMENTARY_FEATURES_REPORT.md` when phase 1 and phase 2 have code
to describe. Cover only features beyond the original booking use cases:

| Feature | Analyze |
|---|---|
| Content search | Why full-text instead of `LIKE`, what still fails for Vietnamese |
| Room rental | Who approves, how a rental blocks a showtime, where the price comes from |
| Recommendations | What the Neo4j modes return and when the fallback is empty |
| Payment amount | Why the browser no longer sends `amount`, from `fix-payment-vulnerability` |
| Notifications | Email is real, SMS is a log, the inbox is not in the UI |

For each feature write the user problem, the chosen design, the limit, and the
test that protects it. No status claims without a command that was actually run.

### Admin screen

After rental is ported, add an admin report page that calls
`GET /api/rentals/report`. Show request count, revenue, and counts by status
and room. The endpoint already returns that shape on the feature branch.

## 4. Responsive mobile

Tailwind `sm`, `md`, and `lg` classes exist. Several flows still assume a wide
screen.

### Fix in this order

1. Seat selection and the hold bar in `Booking.tsx` and `SeatMapGrid.tsx`.
   The grid must scroll horizontally without covering the proceed button.
2. Checkout summary and payment actions. Stack them under 768px.
3. Ticket detail and the QR scanner. The camera preview must fit the width,
   and the result card must not sit under the browser chrome.
4. Admin shell. `AdminLayout` offsets by `md:ml-64` and has no phone drawer.
   Add a menu button below `md` and close it after navigation.
5. Staff counter booking. The seat picker and customer form stack in one column.

Check 390px and 768px in the browser on those five flows. Do not restyle pages
that already wrap. Desktop layout stays as it is.

## Out of this roadmap

Staff `/api/staff/**` gaps, the notification inbox, membership, user delete,
and the canonical cutover stay in `CURRENT_STATE.md`. They are not instructor
items from this review.
