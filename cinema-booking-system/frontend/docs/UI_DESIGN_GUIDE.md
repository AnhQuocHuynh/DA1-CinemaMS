# UI Design Guide

This guide captures UI design rules and visual language for future AI sessions. Keep changes consistent unless a mockup explicitly overrides these choices.

## Color system
- Main: Use `primary` for key actions, highlights, and emphasis.
- Secondary: Use `inverse-surface` or `surface-container` variants for contrast panels.
- Text: `on-surface` for primary text, `on-surface-variant` for secondary text, `outline` for helper labels.
- Status: `error` for destructive actions, `primary` for success-like confirmations unless a specific green exists in the theme.
- Backgrounds: Prefer `surface`, `surface-container-low`, `surface-container-lowest`, and `surface-container-high` over flat white.

## Typography and hierarchy
- Headlines: bold, tight tracking (`tracking-tight` or `tracking-tighter`).
- Micro labels: `text-[10px]` with uppercase + wide tracking for labels and metadata.
- Body text: `text-sm` or `text-xs` with `on-surface-variant` for secondary copy.

## Layout patterns
- Use layout shells: `AdminLayout` and `StaffLayout` for admin/staff pages. Use `PortalTopNav` for user/portal pages.
- Use sticky side panels on wide screens (e.g., checkout/booking summary blocks).
- Prefer multi-column grids on desktop and single column on mobile.
- Keep sections in rounded cards with subtle borders and shadows.

## Components and reuse
- Use existing reusable components first: `AdminPageHeader`, `AdminTopBar`, `StaffTopBar`, `SeatMapGrid`, `SeatLegend`.
- Use hooks from `src/hooks/` to fetch page data and keep pages thin.
- Services in `src/services/apiService.ts` should hold mocks with TODO comments for real API calls.

## Interaction patterns
- Primary buttons: `bg-primary` with white text, bold tracking, and subtle scale on active.
- Secondary buttons: `bg-white` with border and `on-surface` text.
- Avoid purple defaults; keep color choices aligned with current theme tokens.

## Motion and effects
- Keep motion subtle: `transition-all` or `transition-colors` with short durations.
- Use gradient overlays for hero images and ticket cards.

## Mockup alignment checklist
- Verify layout shell matches role (admin/staff/user).
- Confirm data blocks and table sections match mockup ordering.
- Keep spacing generous; avoid dense tables without breathing room.
- Ensure empty/loading states are present and styled.

## Do not
- Do not invent new color tokens or CSS variables without adding them to the theme.
- Do not add arbitrary fonts or change typography scale without a mockup request.
- Do not create new routing patterns; keep routes under /admin, /staff, /user.
