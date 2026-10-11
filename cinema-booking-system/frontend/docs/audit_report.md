# Frontend status against UseCase.md

Date: 2026-10-11. Branch: `refactor-compose-single-postgres` (`ebdfb9d`).

This pass read the pages, services, and gateway routes. It did not run the UI.
"Completed" means the screen calls a real API that exists behind the gateway.
It does not mean the flow was exercised in a browser.

The SPA authenticates with Keycloak and sends requests to
`VITE_API_BASE_URL` (default `http://localhost:5000/api`).

## Completed

| Use case | What the code does |
|---|---|
| UC-01 Đăng ký | `authService.register` redirects to the Keycloak register URL. |
| UC-02 Đăng nhập | `authService.login` uses Keycloak Authorization Code. Token refresh is in `apiClient`. |
| UC-03 Khôi phục mật khẩu | Keycloak `UPDATE_PASSWORD` action. |
| UC-05 Chọn suất chiếu và rạp | Movie, event, theater, and showtime pages call catalog, facility, and showtime APIs. |
| UC-06 Chọn ghế | `Booking.tsx` loads the seat map and holds seats through booking/showtime APIs. |
| UC-07 Thanh toán | Checkout offers Stripe. Success page verifies Stripe and PayPal return URLs. Payment service also has cash confirm. |
| UC-08 Đánh giá | `ReviewSection` is mounted on `MovieDetails.tsx` and `EventDetails.tsx`. |
| UC-09 Tóm tắt bình luận | Same review section requests insight endpoints. |
| UC-10 Quản lý vé | `UserDashboard.tsx` and `TicketInfo.tsx`. |
| UC-13 Mã giảm giá | Checkout can validate a voucher. Admin can list, create, and delete vouchers. |
| UC-14 Hoàn tiền | Ticket and order refund actions call the booking refund API. Payment has a refund endpoint. |
| UC-15 Quét QR | `QRChecker.tsx` posts `/tickets/check-in` once, then stops the camera. |
| UC-16 In vé | Ticket and checkout-success pages download a PDF. |
| UC-17 Tra cứu vé | `TicketLookup.tsx` reads the ticket-by-code API. |
| UC-18 Sơ đồ ghế | `SeatConfigurator.tsx` reads and writes facility seat templates. |
| UC-20 Báo cáo | `AdminDashboard.tsx` calls analytics dashboard routes. Staff dashboard does not; see below. |
| UC-23 Quản lý phim | Movie admin CRUD uses `/api/movies`. |
| UC-24 Quản lý sự kiện | Event admin CRUD uses `/api/events`. |
| UC-25 Quản lý rạp | Cinema CRUD uses `/api/cinemas`. |
| UC-26 Quản lý phòng | Room CRUD uses `/api/cinemas/{id}/rooms`. |
| UC-27 Đăng xuất | `authService.logout` clears the store and calls Keycloak logout. |

Also in the UI, outside the original 27 names: Vietnamese/English copy, light/dark theme, recommendation carousel, auto showtime publish, and profile settings through `/api/users/me`.

## In progress

| Use case | Current behavior | Gap |
|---|---|---|
| UC-04 Tra cứu | Keyword search calls `/api/catalog/search`. | Home still appends `movieData` mocks, including empty-search suggestions. |
| UC-11 Giữ ghế | Redis hold, countdown, and a 5-second seat-map poll. | No server-sent events. Other clients appear only on the next poll. |
| UC-19 Giá vé | Voucher list is real. | Base rate and tiers come from `getPricingOverview` mock data. |
| UC-21 Phân quyền | User list and `PUT /api/users/{id}/role` are real. | `deleteUser` returns success and does not call the API. Permission-rule cards are mock data and are not rendered. |
| UC-22 Quản lý voucher | Create and delete call the API. | Update is a frontend mock. Booking has no `PUT /api/vouchers/{id}`. |
| UC-12 Thông báo | Backend can email after `order.paid` and `order.refunded`. | No bell or inbox. No SignalR client. Gateway has no notification route. SMS sender only logs. |
| Staff dashboard and counter booking | Screens exist. | `staffService` calls `/api/staff/**`. The gateway has no such routes, and booking-service has no staff controller. QR check-in and ticket lookup are the staff calls that do hit a real API. |

## Not done

- Membership. `Membership.tsx` is a static coming-soon page.
- In-app notification inbox.
- Real-time seat push.
- Admin pricing rules backed by an API.
- Voucher edit.
- Keycloak user deletion.
- Fine-grained permission rules beyond `ADMIN`, `STAFF`, and `CUSTOMER`.
- Room rental. That work is on branch `feature/room-rental`, not in this frontend.

## Notes carried forward

`useAdminShowtimes` still calls the mock `getShowtimeSchedules`. The showtime admin page does not use that hook. It loads theaters and room showtimes from the API, and `AutoShowtimeCreator` publishes through `showtimeService`.
