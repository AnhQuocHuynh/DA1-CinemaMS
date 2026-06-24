# Implementation Plan: Frontend Ratings and Comments (Reviews)

Implement the ratings and comments system on the frontend for `MovieDetails` and `EventDetails` pages, integrating with the existing `ReviewController` endpoints from the backend.

## Proposed Changes

### Frontend Types & Services

#### [NEW] [review.ts](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/types/review.ts)
Create interfaces for the Review responses and requests to match the backend structure:
- `ReviewResponse` (id, userId, rating, comment, createdAt, etc.)
- `CreateReviewRequest`
- `ReviewInsightResponse`
- `ReviewEligibilityResponse`

#### [NEW] [reviewService.ts](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/services/reviewService.ts)
Implement Axios calls for the `ReviewController` endpoints:
- `createReview(data: CreateReviewRequest)`
- `getMovieReviews(movieId: number)`
- `getEventReviews(eventId: number)`
- `getMovieInsight(movieId: number)`
- `getEventInsight(eventId: number)`
- `checkMovieEligibility(movieId: number, userId: number)`
- `checkEventEligibility(eventId: number, userId: number)`

---

### Frontend Components

#### [NEW] [StarRating.tsx](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/components/Review/StarRating.tsx)
A reusable component for displaying a star rating (both interactive for forms and static for displaying existing ratings) using `lucide-react` `Star` icon.

#### [NEW] [ReviewCard.tsx](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/components/Review/ReviewCard.tsx)
Displays a single review item, showing the reviewer's generic avatar/name, star rating, comment text, and date.

#### [NEW] [ReviewForm.tsx](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/components/Review/ReviewForm.tsx)
A form that appears for eligible users to select a rating (1-5 stars) and write a comment.

#### [NEW] [ReviewSection.tsx](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/components/Review/ReviewSection.tsx)
A container component taking props `type: 'movie' | 'event'` and `id: number`.
It will handle fetching insights, the list of reviews, and checking user eligibility (from `useAuthStore`'s `userId`). It will render the insights summary, the `ReviewForm` (if eligible), and map over the reviews using `ReviewCard`.

#### [NEW] [RatingBadge.tsx](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/components/Review/RatingBadge.tsx)
A lightweight component taking `type: 'movie' | 'event'` and `id: number`. It fetches the `ReviewInsightResponse` for the given ID on mount and displays the average star rating. This is useful for displaying ratings on list pages without causing performance issues or requiring backend changes immediately.

---

### Frontend Pages Integration

#### [MODIFY] [MovieDetails.tsx](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/pages/MovieDetails.tsx)
- Import `ReviewSection`.
- Place `<ReviewSection type="movie" id={parseInt(movieId)} />` below the movie description in the left column (`lg:col-span-8`).

#### [MODIFY] [EventDetails.tsx](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/pages/EventDetails.tsx)
- Import `ReviewSection`.
- Place `<ReviewSection type="event" id={parseInt(eventId)} />` below the event description in the left column (`lg:col-span-8`).

#### [MODIFY] [admin/MovieManagement.tsx](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/pages/admin/MovieManagement.tsx)
- Import `RatingBadge`.
- Replace the dummy `movie.rating ?? '4.7'` in the table's "Rating" column with `<RatingBadge type="movie" id={movie.id} />`.

#### [MODIFY] [admin/EventManagement.tsx](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/pages/admin/EventManagement.tsx)
- Import `RatingBadge`.
- Add a new "Rating" column to the table and display `<RatingBadge type="event" id={event.id} />` for each event.

#### [MODIFY] [Home.tsx](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/pages/Home.tsx) & [MovieSearch.tsx](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/pages/MovieSearch.tsx)
- Import `RatingBadge`.
- Inside the movie and event cards, display the `<RatingBadge />` near the title or genre.

## Verification Plan

### Manual Verification
1. Open a Movie Details page.
2. Verify that the Insight section loads (e.g., average stars, total reviews).
3. If logged in and eligible, verify the `ReviewForm` is displayed.
4. Submit a new review and verify it appears in the `ReviewList` and the Insight section updates.
5. Repeat the same checks for an Event Details page.
