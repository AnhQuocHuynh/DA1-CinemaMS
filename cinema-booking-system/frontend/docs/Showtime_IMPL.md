# Auto Showtime Creator - Frontend Implementation Plan
# Done
## 1. Overview
The Auto Showtime Creator is an intelligent frontend module designed to assist cinema administrators in scheduling daily movie screenings for a specific room. The core objective is to maximize room utilization (revenue) by automatically fitting the most movies into the operating hours, while providing an interactive, timeline-based interface for manual tinkering and conflict resolution.

## 2. User Interface Architecture

The interface will be divided into three main sections: Configuration, Interactive Timeline, and Validation/Summary.

### 2.1. Configuration Panel (Sidebar or Top Bar)
- **Room & Date Selection:** Dropdowns/Datepickers to establish the scheduling context.
- **Movie Selection Pool:** 
  - A multi-select list or checklist of currently showing movies.
  - Option to set priorities (e.g., "Blockbuster X should play at least 4 times").
- **Constraint Settings:**
  - **Operating Hours:** Start and End times (e.g., 08:00 to 23:59).
  - **Buffer Times:** 
    - *Cleaning Time* (post-movie, e.g., 15 mins).
    - *Ads/Trailers Time* (pre-movie, e.g., 10 mins).
- **Action Buttons:**
  - `Auto-Fill Schedule`: Executes the packing algorithm.
  - `Clear All`: Resets the canvas.

### 2.2. Interactive Timeline (Main Canvas)
A Gantt-chart style timeline for visual scheduling.
- **X-Axis (Time):** Spans the operating hours, with visible markers every 30 or 60 minutes.
- **Y-Axis (Room):** The selected room.
- **Event Blocks:** 
  - Represents a single screening.
  - Visually segmented into: `[ Ads | Movie Content | Cleaning ]`.
  - Color-coded per movie for quick identification.
- **Interactions:**
  - **Drag-and-Drop:** Move blocks horizontally to shift start times.
  - **Snap-to-Grid:** Dropping a block snaps it to the nearest 5-minute interval.
  - **Collision Warnings:** Overlapping blocks turn red or display a warning icon.
  - **Click to Edit:** Clicking a block opens a popover to manually adjust exact times, swap the movie, or delete the screening.

### 2.3. Summary & Action Bar (Bottom)
- **Metrics:** Total screenings, Room utilization percentage (Scheduled Time / Total Operating Time).
- **Validation Status:** Displays a green checkmark if the schedule is valid, or lists specific conflicts (e.g., "Overlap at 14:30").
- **Final Action:** `Save & Publish` button to send the payload to the backend.

## 3. Auto-Fill Algorithm (Frontend)

To maximize revenue (fitting the most movies), the algorithm acts as a greedy interval-packing solver.

### 3.1. Inputs
- `OperatingTime`: e.g., 960 minutes (08:00 to 24:00).
- `SelectedMovies`: Array of movies with their `duration`.
- `BufferTime`: `AdsTime + CleaningTime`.

### 3.2. Packing Strategy
If the goal is purely to fit the *most* screenings, the algorithm should theoretically prioritize shorter movies. However, for a realistic cinema schedule, a round-robin distribution of selected movies is preferred, potentially weighted by priority.

**Proposed Greedy Algorithm (Round-Robin with Maximum Fit):**
0. Fetch existing `Event`s mapped to this room for the given date. These act as hard, immovable blocks in the timeline.
1. Initialize `CurrentTime = OpeningTime`.
2. Shuffle or sort `SelectedMovies` based on admin preference (or cycle through them evenly).
3. Loop:
   - Pick the next movie from the list.
   - Calculate `TotalBlockSize = BufferTime + MovieDuration`.
   - Ensure that `[CurrentTime, CurrentTime + TotalBlockSize]` does NOT overlap with any existing `Event` blocks. If it does, advance `CurrentTime` to the end of the blocking Event and retry.
   - If `CurrentTime + TotalBlockSize <= ClosingTime`:
     - Create Showtime Event: 
       - `Start = CurrentTime`
       - `End = CurrentTime + TotalBlockSize`
     - Append to `ScheduleArray`.
     - Update `CurrentTime = CurrentTime + TotalBlockSize`.
   - If the current movie doesn't fit, try the next shortest movie in the list.
4. Terminate when no selected movie can fit into the remaining time `(ClosingTime - CurrentTime)`.

## 4. State Management & Data Structures

Using React State / Context (or state managers like Zustand/Redux):

```typescript
// Core Types
interface Movie {
  id: string;
  title: string;
  durationMinutes: number;
  colorCode: string;
}

interface ShowtimeBlock {
  id: string; // Temporary frontend ID or DB ID
  movieId?: string;
  eventId?: string; // Events act exactly like Showtimes but without a movie
  startTime: string; // ISO or HH:mm
  endTime: string;
  isConflict: boolean;
  isLocked: boolean; // Events are typically locked and cannot be moved by auto-fill
}

interface ScheduleConstraints {
  openTime: string;
  closeTime: string;
  cleaningTimeMinutes: number;
  adsTimeMinutes: number;
}
```

## 5. Technical Stack Recommendations

To build the Interactive Timeline efficiently without reinventing the wheel:
1. **Timeline UI Library:**
   - **`@fullcalendar/react`** (with `@fullcalendar/resource-timeline`): Extremely robust, handles drag-and-drop, resizing, and overlap detection out of the box.
   - **`react-calendar-timeline`**: Good alternative specifically designed for horizontal Gantt/Timeline views.
2. **Date Manipulation:**
   - **`dayjs`** or **`date-fns`**: Crucial for calculating durations, adding buffer minutes, and formatting times without the bulk of Moment.js.
3. **Drag-and-Drop (if building custom):**
   - **`dnd-kit`**: Modern, accessible drag-and-drop for React.

---

## 6. Implementation Status & Deviation Log

> **Status:** ✅ Core feature implemented. ⚠️ Technical stack deviates from Section 5 recommendations.

### What Was Built

| File | Description |
|---|---|
| [`src/utils/scheduleUtils.ts`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/utils/scheduleUtils.ts) | Pure helpers: `toMinutes`, `toHHMM`, `toISO`, `runAutoFill`, `detectConflicts`, `COLOUR_CLASSES` |
| [`src/hooks/useAutoShowtime.ts`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/hooks/useAutoShowtime.ts) | React hook: state management, autoFill, moveBlock, removeBlock, publishSchedule |
| [`src/components/admin/AutoShowtimeCreator.tsx`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/components/admin/AutoShowtimeCreator.tsx) | Full modal UI: sidebar config, Gantt timeline, block list table, publish bar |
| [`src/pages/admin/ShowtimeManagement.tsx`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/pages/admin/ShowtimeManagement.tsx) | Updated admin page: real API data, delete, search, Auto-Fill Creator modal trigger |
| [`src/services/showtimeService.ts`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/services/showtimeService.ts) | Extended with `getShowtimesByRoom`, `createShowtime`, `deleteShowtime` |
| [`src/types/schedule.ts`](file:///c:/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/types/schedule.ts) | New types: `ShowtimeBlock`, `ScheduleConstraints`, `ScheduledMovie`, `CreateShowtimePayload` |

### Library Deviation — RESOLVED ✅

| Spec Recommendation | Status | Notes |
|---|---|---|
| `@fullcalendar/react` (resource-timeline) | ⏭️ Skipped | Requires paid commercial licence |
| `react-calendar-timeline` | ⏭️ Skipped | Unmaintained, React 18 issues |
| `dayjs` | ✅ **Implemented** | All time helpers in `scheduleUtils.ts` now use `dayjs` (with `customParseFormat` + `duration` plugins) |
| `dnd-kit` | ✅ **Implemented** | `AutoShowtimeCreator.tsx` uses `DndContext`, `useDraggable`, `DragOverlay`, `MouseSensor`, `TouchSensor` from `@dnd-kit/core` |

### Recommended Follow-Up (when decided)

- **Option A** — ✅ **Done** (`dnd-kit` + `dayjs` added, no visual changes)
- **Option B** (full spec compliance): Swap the custom `<div>`-based Gantt for `react-calendar-timeline` (pin to a React-18-patched fork) or evaluate `@bryntum/timeline` as a free FullCalendar alternative. Larger refactor but delivers resizing, resource rows, and built-in accessibility.

