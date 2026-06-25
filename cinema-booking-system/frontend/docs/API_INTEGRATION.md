# Frontend-Backend API Integration Alignment

This document outlines the current state of integration between the Frontend (`cinema-booking-system/frontend`) and Backend (`cinema-booking-system/backend`) based on recent backend API updates. 

## 1. Updated APIs & Successful Wirings
- **Seat Hold Release (`DELETE /api/showtimes/{id}/hold`)**: The backend has introduced a DELETE endpoint for releasing locked seats. The frontend `bookingService.ts` correctly wires this up in `releaseHeldSeats` sending `{ data: { seatIds } }`. The `API_DOCS.md` has been updated to reflect this endpoint.

## 2. Unwired / Mismatched APIs (Due to Backend Updates)

### Critical Gap: Couple Seats Implementation ("Ghost Twin" Strategy)
**Impact:** High. The Couple Seats feature will not function as intended.
- **Frontend Expectation (`COUPLE_SEATS_IMPLEMENTATION.md`)**: The frontend expects a "Ghost Twin" data strategy where `GET /showtimes/{id}/seats` returns:
  - A `pairId` field linking the two halves of a couple seat.
  - A `type` field that explicitly resolves to `'couple_left'` and `'couple_right'`.
- **Backend Reality (`ShowtimeSeatResponse.java` & `ShowtimeServiceImpl.java`)**: 
  - There is **no `pairId`** field in the `ShowtimeSeatResponse` DTO or the underlying `SeatTemplate` entity.
  - The `seatType` is derived purely from `SeatType.getName().toLowerCase()`, which may just be "couple" or "normal", and lacks spatial context (left vs right).
- **Current Wiring (`bookingService.ts`)**: The frontend parses the `ShowtimeSeatResponse` directly to the `Seat` state object but does not synthesize a `pairId` nor split "couple" into "couple_left/right". Consequently, clicking a couple seat will fail to auto-select its partner, breaking the checkout rule that couple seats must be bought in pairs.

**Action Required**: 
- *Option A (Backend Fix)*: Update the `SeatTemplate` entity and `ShowtimeSeatResponse` DTO to explicitly return `pairId` and strict `'couple_left'` / `'couple_right'` type literals.
- *Option B (Frontend Fix)*: Implement a mock/synthesis layer in `bookingService.ts` (`getSeatMap` function) that dynamically injects `pairId` and maps `couple_left`/`couple_right` based on row labels and column parity (as suggested in the mock data section of `COUPLE_SEATS_IMPLEMENTATION.md`).

## 3. General Frontend Wiring Observations
- **`CheckoutSuccess.tsx`**: Uses `completedOrder.seatIdsSnapshot` which provides a comma-separated list of seat IDs rather than seat labels. The frontend handles this gracefully by just displaying the total seat count.
- **Orders (`POST /api/orders`)**: The frontend service uses raw JSON returns while other endpoints expect an `ApiResponse` wrapper. Backend controllers return `Order` entities directly without an `ApiResponse` wrapper for some routes, so this mismatch remains functional but structurally inconsistent.

## 4. Unconnected / Mocked Pages and Services (Frontend)
The following components and services are still using mock data and are **not yet connected** to the backend API:

### Skipped Operations (Intentionally Deferred)
- **Schedules / Showtimes**: Update, Delete, and global fetching are missing in the backend and remain completely mocked.
- **Pricing**: No corresponding backend entity or API exists. This remains completely mocked.

### Services
- **`adminService.ts`**: Mostly wired, but operations with missing backend endpoints (e.g. Schedule RUD, Pricing CRUD, Voucher Update/Delete, User Update/Delete) remain mocked.
- **`staffService.ts`**: 100% Mock Data. All staff operations (dashboard data, recent bookings, ticket validation) return mock objects and are completely disconnected from the backend.

### Pages & UI Components
- **`Home.tsx`**: Mixes real API data with hardcoded data. It imports `mockMovies` from `../utils/movieData` and includes a large block labeled `TODO: REMOVE THIS ENTIRE BLOCK once backend movie data is sufficient` to populate "mockCards".
- **`MovieSearch.tsx`**: Augments actual backend search results with mock results from `../utils/movieData` (`mockResults`). Includes a warning UI label `(mock data – remove later)` and a TODO to remove it when the backend is complete.
- **`ForgotPassword.tsx`**: The actual API call is commented out (`// TODO: Uncomment for real implementation`), and the form submission relies on a simulated delay instead of communicating with the backend.
