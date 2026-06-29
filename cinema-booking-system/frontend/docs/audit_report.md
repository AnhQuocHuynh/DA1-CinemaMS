# Frontend Re-Audit Report (Post-Dashboard Merge)

After reviewing the codebase and the latest `front-end-impl-api` merge against the 27 standard use cases defined in `UseCase.md`, here is the updated completion status of the frontend.

> [!TIP]
> **Overall Status**: The Admin and Staff dashboards (UC-20) have been successfully merged and integrated. We are very close to 100% completion! The remaining items are primarily bugs, UX refinements, and wiring up existing components.

## 🟢 Completed (Fully Implemented)
*Most use cases are fully implemented. Notable recent completions include:*
- **UC-20 Báo cáo & thống kê**: Implemented via `AdminDashboard.tsx` and `StaffDashboard.tsx` with real API integrations.
- **UC-10, UC-14 Quản lý & Hoàn vé**: `TicketInfo.tsx` and `UserDashboard.tsx` are fully functional.
- **UC-18, UC-19, UC-21 -> UC-26 Quản lý hệ thống**: All admin CRUD modules (`RoomManagement.tsx`, `SeatConfigurator.tsx`, `PricingAndVouchers.tsx`, etc.) are implemented and wired.

---

## 🟡 Partially Completed / Needs Wiring

| Use Case | Current State | What's Missing / Needed |
| :--- | :--- | :--- |
| **UC-08 & UC-09 Đánh giá & Tóm tắt bình luận** | Components like `ReviewForm.tsx`, `ReviewSection.tsx`, and `StarRating.tsx` have been built and reside in `src/components/Review/`. | **Missing Integration**: These components are NOT yet integrated into `MovieDetails.tsx` or `EventDetails.tsx`. They need to be wired to the backend and displayed on the detail pages. |
| **UC-04 Tra cứu phim (Search Auto-complete)** | The search bar exists on the homepage (`Home.tsx` / `MovieSearch.tsx`). | **Needs Refinement**: The current auto-complete UX/logic is reported as "not good" and needs an overhaul for better usability and accuracy. |
| **UC-11 Giữ ghế tạm thời (Seat Holding)** | The booking flow works and locks seats via the backend. | **Needs Refactoring**: The current strategy relies on basic polling or local state. It should be refactored to use **Server-Sent Events (SSE)** for real-time seat map synchronization across different clients. |
| **UC-15 Quét mã QR** | `staff/QRChecker.tsx` is built and functional. | **Bug Fix Needed**: There is a known bug where scanning a ticket keeps sending redundant API requests even after the initial success, showing "invalid/checked-in" loops until the QR is removed from the camera. |
| **UC-07 Thanh toán hóa đơn** | Checkout UI is complete (`Checkout.tsx`). | **Missing Gateway**: Currently uses a simulated payment flow. Needs integration with a real payment provider (VNPay/Momo) if going to production. |

---

## 🔴 Missing (Not Implemented in Frontend UI)

| Use Case | Status & Missing Elements |
| :--- | :--- |
| **UC-12 Nhận thông báo xác nhận** | **Missing UI**: While emails might be handled by the backend, the frontend lacks an in-app "Notification Bell" or "Inbox" UI to show users their booking confirmations or system alerts. |

## 🚀 Next Steps Recommendation
Based on this audit and previous discussions, the immediate technical priorities should be:
1. **Wire up the Reviews**: Integrate the `ReviewSection` into `MovieDetails.tsx`.
2. **Fix the QR Scanner Bug**: Add a debounce or a strict success lock to the QR scanner in `QRChecker.tsx`.
3. **Overhaul Homepage Search**: Improve the auto-complete logic and UI/UX.
4. **Implement SSE for Seat Map**: Upgrade the `Booking.tsx` / `SeatMapGrid.tsx` to listen to real-time seat hold events.
