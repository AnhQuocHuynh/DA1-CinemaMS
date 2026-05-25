# Frontend Implementation Guide: Couple Seats (Double Assets)
This guide provides the technical design and reference implementation details for incorporating **Couple Seats** (Double Assets/Cozy Couches) into the frontend seat map and checkout workflow.

---

## 1. Core Data Strategy: "The Ghost Twin"

Instead of forcing a single double seat to occupy multiple coordinates or span columns (which complicates grid layouts, mapping logic, and backend matching), we use **"The Ghost Twin"** strategy:
- Every double seat consists of **two distinct data points (seats)** in the grid.
- They are explicitly linked using a `pairId` reference pointing to each other.
- They are designated with unique seat types: `'couple_left'` and `'couple_right'`.

### Mock JSON Representation:
```json
[
  { "id": "A1", "label": "A1", "row": "A", "number": 1, "type": "single", "status": "available", "price": 24 },
  { "id": "A2", "label": "A2", "row": "A", "number": 2, "type": "couple_left", "status": "available", "price": 30, "pairId": "A3" },
  { "id": "A3", "label": "A3", "row": "A", "number": 3, "type": "couple_right", "status": "available", "price": 30, "pairId": "A2" }
]
```

### Why this works:
1. **Grid Integrity**: Keeps the React CSS grid mapping strictly $1 \times 1$ without complex `col-span` logic.
2. **Backend Alignment**: The backend database and ticketing engine treats every seat as a separate ticketable ID anyway.

---

## 2. Type System Updates

Update the type definitions in [src/types/booking.ts](file:///c:/Users/Nguyen/OneDrive/M%C3%A1y%20t%C3%ADnh/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/types/booking.ts) to support the new seat types and the linking identifier.

```typescript
// src/types/booking.ts
export type SeatStatus = 'available' | 'selected' | 'sold' | 'holding';

// Add 'couple_left' and 'couple_right'
export type SeatType = 'normal' | 'vip' | 'couple_left' | 'couple_right';

export interface Seat {
  id: string;
  label: string;
  row: string;
  number: number;
  status: SeatStatus;
  type: SeatType;
  price: number;
  isPathway?: boolean;
  pairId?: string; // Links couple seats together
}
```

---

## 3. State Management (Zustand Store)

Modify [src/store/bookingStore.ts](file:///c:/Users/Nguyen/OneDrive/M%C3%A1y%20t%C3%ADnh/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/store/bookingStore.ts) to support batch-toggling of seats. Instead of toggling seats individually, we introduce a `toggleSeats` action that accepts an array of seats. This allows atomic atomic selection/deselection of couple pairs and enforces the seat limits accurately.

```typescript
// src/store/bookingStore.ts
import { create } from 'zustand';
import { Seat } from '../types/booking';

interface BookingState {
  selectedSeats: Seat[];
  showtimeId: string | null;
  holdExpiresAt: string | null;

  setShowtimeId: (showtimeId: string | null) => void;
  setHoldExpiresAt: (value: string | null) => void;
  toggleSeats: (seats: Seat[], maxSeats: number) => void;
  clearSelection: () => void;
}

export const useBookingStore = create<BookingState>((set, get) => ({
  selectedSeats: [],
  showtimeId: null,
  holdExpiresAt: null,

  setShowtimeId: (showtimeId) => set({ showtimeId }),
  setHoldExpiresAt: (value) => set({ holdExpiresAt: value }),
  
  toggleSeats: (seats, maxSeats = 6) => {
    const current = get().selectedSeats;
    
    // Check if ALL seats in the input array are already selected
    const allSelected = seats.every((seat) => 
      current.some((item) => item.id === seat.id)
    );

    if (allSelected) {
      // DESELECT: Remove all seats in the array
      const idsToRemove = seats.map((s) => s.id);
      set({
        selectedSeats: current.filter((item) => !idsToRemove.includes(item.id)),
      });
    } else {
      // SELECT: Filter out seats already in cart, prepare to add the rest
      const toAdd = seats.filter((s) => !current.some((item) => item.id === s.id));
      
      // Enforce the ticket booking limit (e.g. max 6)
      if (current.length + toAdd.length > maxSeats) {
        throw new Error(`Booking limit exceeded. You can select a maximum of ${maxSeats} seats.`);
      }

      set({
        selectedSeats: [
          ...current,
          ...toAdd.map((s) => ({ ...s, status: 'selected' as const })),
        ],
      });
    }
  },
  
  clearSelection: () => set({ selectedSeats: [], showtimeId: null, holdExpiresAt: null }),
}));
```

---

## 4. Custom Hook Logic (`useSeatSelection`)

Update the custom hook in [src/hooks/useSeatSelection.ts](file:///c:/Users/Nguyen/OneDrive/M%C3%A1y%20t%C3%ADnh/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/hooks/useSeatSelection.ts) to orchestrate finding and toggling the partner "Ghost Twin" seat when a couple seat is clicked.

```typescript
// src/hooks/useSeatSelection.ts
import { useEffect, useMemo, useState } from 'react';
import { bookingService } from '../services/bookingService';
import { useBookingStore } from '../store/bookingStore';
import { Seat, SeatMap } from '../types/booking';

export const useSeatSelection = (showtimeId: string) => {
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { selectedSeats, toggleSeats, setShowtimeId } = useBookingStore();

  useEffect(() => {
    const loadSeatMap = async () => {
      try {
        const data = await bookingService.getSeatMap(showtimeId);
        setSeatMap(data);
        setShowtimeId(showtimeId);
      } catch (err) {
        console.error('Failed to load seat map:', err);
        setError('Could not load seat layout. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadSeatMap();
  }, [showtimeId, setShowtimeId]);

  const summary = useMemo(() => {
    const subtotal = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
    // Flat convenience fee per ticket
    const feePerTicket = 1.5;
    const fees = selectedSeats.length * feePerTicket;
    
    return {
      subtotal,
      fees,
      total: subtotal + fees,
    };
  }, [selectedSeats]);

  const isSelected = (seat: Seat) => selectedSeats.some((item) => item.id === seat.id);

  // Wrapper function to resolve Ghost Twins before triggering store state change
  const handleToggleSeat = (seat: Seat) => {
    if (!seatMap) return;

    let seatsToToggle = [seat];

    if (seat.pairId) {
      // Find the partner twin seat in the grid layout
      const partner = seatMap.rows
        .flatMap((r) => r.seats)
        .find((s) => s.id === seat.pairId);

      if (partner) {
        // Enforce atomic pairs: left & right must toggle together
        seatsToToggle = [seat, partner];
      }
    }

    try {
      // Enforce standard cinema max ticket limit of 6
      toggleSeats(seatsToToggle, 6);
    } catch (err: any) {
      // Propagate the validation message to the page component
      alert(err.message); 
    }
  };

  return { 
    seatMap, 
    selectedSeats, 
    isSelected, 
    toggleSeat: handleToggleSeat, 
    summary, 
    isLoading,
    error
  };
};
```

---

## 5. UI Integration & Styling (`SeatMapGrid`)

To make two adjacent grid cells look like a cohesive cozy sofa, we must style them dynamically and eliminate the CSS Grid gap.

### The CSS Bridging Trick
If the parent container utilizes a grid layout with a gap (e.g. `gap-2` which translates to `8px`), the seats will be separated. We can bridge this gap using standard Tailwind utilities:
- **`couple_left`**: Applies a negative right margin: `-mr-[4px]` (half the grid gap). It rounds the left corners and squares the right: `rounded-l-lg rounded-r-none`.
- **`couple_right`**: Applies a negative left margin: `-ml-[4px]` (half the grid gap). It rounds the right corners and squares the left: `rounded-r-lg rounded-l-none`.
- **Spacing Adjustment**: This causes the two buttons to stretch and overlap border-to-border, combining into a seamless $2 \times 1$ visual component.

### The Hover Effect & Visual Sync
We track which seat is hovered locally in `SeatMapGrid` so we can apply the hover class to both twin seats simultaneously.

```tsx
// src/components/portal/SeatMapGrid.tsx
import React, { useState } from 'react';
import { SeatMap, Seat } from '../../types/booking';

interface SeatMapGridProps {
  seatMap: SeatMap;
  isSelected: (seat: Seat) => boolean;
  onSeatToggle: (seat: Seat) => void;
}

export const SeatMapGrid: React.FC<SeatMapGridProps> = ({ seatMap, isSelected, onSeatToggle }) => {
  // Track hovered seat to sync couple seats hover states
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null);

  return (
    <div
      className="grid gap-2 max-w-3xl mx-auto"
      style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}
    >
      {seatMap.rows.flatMap((row) =>
        row.seats.map((seat) => {
          if (seat.isPathway) {
            return (
              <div
                key={seat.id}
                className="w-full aspect-square rounded-sm bg-transparent"
                aria-hidden="true"
              />
            );
          }

          const selected = isSelected(seat);
          const isDisabled = seat.status === 'sold' || seat.status === 'holding';

          // Determine if this seat should show hover highlight (synced with its twin)
          const isHovered = hoveredSeat && (
            hoveredSeat.id === seat.id || 
            (seat.pairId && seat.pairId === hoveredSeat.id)
          );

          // 1. Core Background Styles using theme tokens
          let baseClass = '';
          if (seat.status === 'sold') {
            baseClass = 'bg-surface-container-low text-outline/30 cursor-not-allowed border border-outline-variant/10 opacity-40 line-through';
          } else if (seat.status === 'holding') {
            baseClass = 'bg-secondary-container text-on-secondary-container border border-dashed border-secondary/50 cursor-wait animate-pulse';
          } else if (selected) {
            baseClass = 'bg-primary text-white border border-primary-container font-bold shadow-sm';
          } else {
            // Available: base + synchronized hover styles
            baseClass = `bg-surface-container-high text-on-surface-variant border border-outline-variant/30 transition-all cursor-pointer ${
              isHovered 
                ? 'bg-surface-container-highest border-primary/50 text-on-surface scale-[1.03]' 
                : 'hover:bg-surface-container-highest hover:text-on-surface hover:scale-[1.02]'
            }`;
          }

          // 2. Corner rounding and gap elimination for Couple Seats
          let shapeClass = 'rounded-sm';
          if (seat.type === 'couple_left') {
            shapeClass = 'rounded-l-lg rounded-r-none border-r-0 -mr-[4px] relative z-10';
          } else if (seat.type === 'couple_right') {
            shapeClass = 'rounded-r-lg rounded-l-none border-l-0 -ml-[4px] relative z-10';
          }

          // 3. VIP seat border highlight
          const vipClass = seat.type === 'vip' ? 'border-2 border-amber-400/80' : '';

          return (
            <button
              key={seat.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onSeatToggle(seat)}
              onMouseEnter={() => !isDisabled && setHoveredSeat(seat)}
              onMouseLeave={() => setHoveredSeat(null)}
              className={`${baseClass} ${shapeClass} ${vipClass} w-full aspect-square flex flex-col items-center justify-center text-[9px] font-bold select-none focus:outline-none focus:ring-1 focus:ring-primary/40`}
              title={`${seat.label} • ${seat.type.replace('_', ' ').toUpperCase()}`}
            >
              {/* Show label if selected, hovered, or normally available */}
              <span className={`transition-opacity duration-150 ${(selected || isHovered || seat.status === 'available') ? 'opacity-100' : 'opacity-40'}`}>
                {seat.label}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
};
```

---

## 6. Legend Updates (`SeatLegend`)

Add visual representation of VIP and Couple seats in [src/components/portal/SeatLegend.tsx](file:///c:/Users/Nguyen/OneDrive/M%C3%A1y%20t%C3%ADnh/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/components/portal/SeatLegend.tsx) so users understand what they represent on the grid layout.

```tsx
// src/components/portal/SeatLegend.tsx
import React from 'react';

export const SeatLegend: React.FC = () => {
  return (
    <div className="mt-16 flex flex-wrap justify-center gap-8 py-6 bg-surface-container-low rounded-xl border border-outline-variant/10">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-sm bg-surface-container-high border border-outline-variant/30" />
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Available</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-sm bg-primary border border-primary-container" />
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Selected</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-sm bg-secondary-container border border-dashed border-secondary/50" />
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Holding</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-sm bg-surface-container-low border border-outline-variant/10 opacity-40 line-through" />
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Sold</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-sm bg-surface-container-high border-2 border-amber-400/80" />
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">VIP</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex -space-x-1">
          <div className="w-5 h-5 rounded-l-md bg-surface-container-high border border-outline-variant/30 border-r-0" />
          <div className="w-5 h-5 rounded-r-md bg-surface-container-high border border-outline-variant/30 border-l-0" />
        </div>
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Couple Seat</span>
      </div>
    </div>
  );
};
```

---

## 7. Mock Data & Backend Adaptor Setup

Ensure the server API responses (simulated in [src/services/bookingService.ts](file:///c:/Users/Nguyen/OneDrive/M%C3%A1y%20t%C3%ADnh/DoAn1/DA1-CinemaMS/cinema-booking-system/frontend/src/services/bookingService.ts)) return matching `pairId` linkages and custom `type` fields for designated couple seat rows (commonly the last row in the cinema theatre, e.g., Row H).

```typescript
// Example mockup configuration inside getSeatMap in src/services/bookingService.ts
const mockSeatMap = {
  rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((row) => {
    const isCoupleRow = row === 'H'; // Designate last row for double assets
    
    return {
      rowLabel: row,
      seats: Array.from({ length: 14 }).map((_, index) => {
        const isPathway = !isCoupleRow && (index === 2 || index === 11);
        const seatId = `${row}${index + 1}`;
        
        let type: SeatType = row === 'G' ? 'vip' : 'normal';
        let pairId: string | undefined;

        if (isCoupleRow) {
          // Pair consecutive indexes: (1,2), (3,4), (5,6), (7,8), (9,10), (11,12), (13,14)
          const isEven = index % 2 === 0;
          type = isEven ? 'couple_left' : 'couple_right';
          pairId = isEven 
            ? `${row}${index + 2}` // points to odd right neighbor
            : `${row}${index}`;     // points to even left neighbor
        }

        return {
          id: seatId,
          label: isPathway ? '' : seatId,
          row,
          number: index + 1,
          status: 'available',
          type,
          price: isCoupleRow ? 35 : (row === 'G' ? 30 : 24),
          isPathway,
          pairId,
        };
      }),
    };
  }),
};
```

---

## 8. UX Guidelines & Edge Case Handling

1. **Atomic Releases**: When a hold timer expires, make sure the hold release API payload contains both seat IDs (`[seat.id, seat.pairId]`) so they become available to other guests simultaneously.
2. **Checkout Summary UI**:
   - In the Checkout sidebar or order confirmation screen, display couple seats clearly. Group them using parenthetical tags: `H1 - H2 (Couple)`.
   - Ensure the ticket count displays 2 for a single booking of a couple seat, preventing booking total mismatches.
3. **Responsive Scaling**: On small screens, keep the seat grid elements compact. Use CSS perspective or standard overflow horizontal scrolling (`overflow-x-auto`) to let users easily pan around the layout on mobile devices.
