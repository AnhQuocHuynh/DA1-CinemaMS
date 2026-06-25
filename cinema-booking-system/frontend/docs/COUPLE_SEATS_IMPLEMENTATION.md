# Frontend Implementation Guide: Couple Seats (Column Span)
# Done
This guide provides the technical design and reference implementation details for incorporating **Couple Seats** (Double Assets/Cozy Couches) into the frontend seat map and checkout workflow, based on the backend's data model.

---

## 1. Core Data Strategy: "Single Entity, Column Span"

The backend database and ticketing engine treat a couple seat as **one logical seat** that spans two physical columns. Therefore, the frontend receives a single seat object for each couple seat with a `columnSpan` property of `2` and `seatTypeCode` of `'COUPLE'`.

There is no "Ghost Twin" or linked `pairId`. A couple seat is a single selectable entity that maps to a single Ticket and single ShowtimeSeat on the backend.

### Mock JSON Representation:
```json
[
  { "id": 1, "seatId": "1", "label": "H1", "rowLabel": "H", "columnNumber": 1, "seatTypeCode": "COUPLE", "columnSpan": 2, "status": "AVAILABLE", "price": 100000 },
  { "id": 2, "seatId": "2", "label": "H3", "rowLabel": "H", "columnNumber": 3, "seatTypeCode": "COUPLE", "columnSpan": 2, "status": "AVAILABLE", "price": 100000 }
]
```

### Why this works:
1. **Backend Alignment**: The backend sends one `ShowtimeSeatResponse` per couple seat, completely matching the frontend representation.
2. **Simplified State**: We don't need complex `pairId` resolution or atomic toggle logic. Clicking the couple seat toggles exactly one item in the cart.
3. **True Atomicity**: Seat-locking and booking requests only require sending one seat ID. The backend locks the entire couple seat intrinsically.

---

## 2. Type System Updates

Update the type definitions in `src/types/booking.ts` to reflect the backend DTO structure, specifically adding `columnSpan` and matching `seatTypeCode`.

```typescript
// src/types/booking.ts
export type SeatStatus = 'AVAILABLE' | 'SELECTED' | 'SOLD' | 'HOLDING';

export type SeatTypeCode = 'STANDARD' | 'VIP' | 'COUPLE';

export interface Seat {
  id: number; // The numeric ID from backend
  seatId: string; // The UUID or identifier from backend
  label: string;
  rowLabel: string;
  columnNumber: number;
  columnSpan: number;
  status: SeatStatus;
  seatTypeCode: SeatTypeCode;
  price: number;
  isPathway?: boolean;
}
```

---

## 3. State Management (Zustand Store)

Modify `src/store/bookingStore.ts` to handle simple toggling of single entities while still accurately calculating seat counts (since a couple seat might count as 2 physical seats against a limit of 6 max seats per booking).

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
  toggleSeat: (seat: Seat, maxSeats: number) => void;
  clearSelection: () => void;
}

export const useBookingStore = create<BookingState>((set, get) => ({
  selectedSeats: [],
  showtimeId: null,
  holdExpiresAt: null,

  setShowtimeId: (showtimeId) => set({ showtimeId }),
  setHoldExpiresAt: (value) => set({ holdExpiresAt: value }),
  
  toggleSeat: (seat, maxSeats = 6) => {
    const current = get().selectedSeats;
    const isSelected = current.some((s) => s.id === seat.id);

    if (isSelected) {
      // DESELECT
      set({ selectedSeats: current.filter((s) => s.id !== seat.id) });
    } else {
      // SELECT
      // Calculate current total physical seats selected
      const currentPhysicalCount = current.reduce(
        (total, s) => total + (s.seatTypeCode === 'COUPLE' ? 2 : 1), 
        0
      );
      const addingPhysicalCount = seat.seatTypeCode === 'COUPLE' ? 2 : 1;

      // Enforce the ticket booking limit (e.g. max 6 physical seats)
      if (currentPhysicalCount + addingPhysicalCount > maxSeats) {
        throw new Error(`Booking limit exceeded. You can select a maximum of ${maxSeats} physical seats.`);
      }

      set({
        selectedSeats: [...current, { ...seat, status: 'SELECTED' }],
      });
    }
  },
  
  clearSelection: () => set({ selectedSeats: [], showtimeId: null, holdExpiresAt: null }),
}));
```

---

## 4. Custom Hook Logic (`useSeatSelection`)

The hook in `src/hooks/useSeatSelection.ts` becomes much simpler since we no longer need to look up "Ghost Twins". We simply pass the single seat object to the store.

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
  
  const { selectedSeats, toggleSeat, setShowtimeId } = useBookingStore();

  useEffect(() => {
    // ... data fetching logic ...
  }, [showtimeId, setShowtimeId]);

  const summary = useMemo(() => {
    const subtotal = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
    // Flat convenience fee per PHYSICAL ticket
    const physicalSeatCount = selectedSeats.reduce(
        (total, s) => total + (s.seatTypeCode === 'COUPLE' ? 2 : 1), 
        0
    );
    const feePerTicket = 1.5;
    const fees = physicalSeatCount * feePerTicket;
    
    return {
      subtotal,
      fees,
      total: subtotal + fees,
    };
  }, [selectedSeats]);

  const isSelected = (seat: Seat) => selectedSeats.some((item) => item.id === seat.id);

  const handleToggleSeat = (seat: Seat) => {
    try {
      // Toggle single entity
      toggleSeat(seat, 6);
    } catch (err: any) {
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

Because a couple seat is represented as a single entity spanning 2 columns, our CSS Grid implementation must leverage `grid-column: span 2` to physically widen the button to fill the space of two standard seats plus the grid gap.

### The CSS `col-span` approach
- We use Tailwind's `col-span-2` dynamically if `seat.columnSpan === 2`.
- This ensures the button spans exactly two columns in the `gridTemplateColumns`.

```tsx
// src/components/portal/SeatMapGrid.tsx
import React from 'react';
import { SeatMap, Seat } from '../../types/booking';

interface SeatMapGridProps {
  seatMap: SeatMap;
  isSelected: (seat: Seat) => boolean;
  onSeatToggle: (seat: Seat) => void;
}

export const SeatMapGrid: React.FC<SeatMapGridProps> = ({ seatMap, isSelected, onSeatToggle }) => {
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
          const isDisabled = seat.status === 'SOLD' || seat.status === 'HOLDING';

          let baseClass = '';
          if (seat.status === 'SOLD') {
            baseClass = 'bg-surface-container-low text-outline/30 cursor-not-allowed border border-outline-variant/10 opacity-40 line-through';
          } else if (seat.status === 'HOLDING') {
            baseClass = 'bg-secondary-container text-on-secondary-container border border-dashed border-secondary/50 cursor-wait animate-pulse';
          } else if (selected) {
            baseClass = 'bg-primary text-white border border-primary-container font-bold shadow-sm';
          } else {
            baseClass = 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30 transition-all cursor-pointer hover:bg-surface-container-highest hover:text-on-surface hover:scale-[1.02]';
          }

          // Apply grid column spanning and custom shape for Couple Seats
          const isCouple = seat.seatTypeCode === 'COUPLE';
          const spanClass = isCouple ? 'col-span-2' : 'col-span-1';
          const shapeClass = isCouple ? 'rounded-lg aspect-auto h-full w-full' : 'rounded-sm w-full aspect-square';

          const vipClass = seat.seatTypeCode === 'VIP' ? 'border-2 border-amber-400/80' : '';

          return (
            <button
              key={seat.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onSeatToggle(seat)}
              className={`${baseClass} ${shapeClass} ${spanClass} ${vipClass} flex flex-col items-center justify-center text-[9px] font-bold select-none focus:outline-none focus:ring-1 focus:ring-primary/40`}
              title={`${seat.label} • ${seat.seatTypeCode}`}
            >
              <span className={`transition-opacity duration-150 ${(selected || seat.status === 'AVAILABLE') ? 'opacity-100' : 'opacity-40'}`}>
                {seat.label} {isCouple && '(Couple)'}
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

Update `src/components/portal/SeatLegend.tsx` to reflect the unified, spanned couple seat instead of two bridged seats.

```tsx
// src/components/portal/SeatLegend.tsx
import React from 'react';

export const SeatLegend: React.FC = () => {
  return (
    <div className="mt-16 flex flex-wrap justify-center gap-8 py-6 bg-surface-container-low rounded-xl border border-outline-variant/10">
      {/* ... other legend items ... */}
      
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-sm bg-surface-container-high border-2 border-amber-400/80" />
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">VIP</span>
      </div>

      <div className="flex items-center gap-3">
        {/* Render a wide rectangle to represent the column span 2 */}
        <div className="w-11 h-5 rounded-md bg-surface-container-high border border-outline-variant/30" />
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Couple Seat</span>
      </div>
    </div>
  );
};
```

---

## 7. Mock Data & Backend Adaptor Setup

When testing with mock data before the API integration is complete, make sure to simulate the `columnSpan` correctly.

```typescript
// Example mockup configuration inside getSeatMap in src/services/bookingService.ts
const mockSeatMap = {
  rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((row) => {
    const isCoupleRow = row === 'H';
    const seats = [];
    
    // For normal rows, generate 14 seats
    // For couple row, generate 7 seats spanning 2 columns each
    const seatCount = isCoupleRow ? 7 : 14;

    for (let index = 0; index < seatCount; index++) {
      const isPathway = !isCoupleRow && (index === 2 || index === 11);
      
      // Calculate true column number. Normal: 1, 2, 3... Couple: 1, 3, 5...
      const columnNumber = isCoupleRow ? (index * 2) + 1 : index + 1;
      const seatId = `${row}${columnNumber}`;
      
      const type: SeatTypeCode = isCoupleRow ? 'COUPLE' : (row === 'G' ? 'VIP' : 'STANDARD');
      const columnSpan = isCoupleRow ? 2 : 1;

      seats.push({
        id: index,
        seatId: seatId,
        label: isPathway ? '' : seatId,
        rowLabel: row,
        columnNumber: columnNumber,
        status: 'AVAILABLE',
        seatTypeCode: type,
        columnSpan: columnSpan,
        price: isCoupleRow ? 200000 : (row === 'G' ? 120000 : 75000),
        isPathway,
      });
    }

    return { rowLabel: row, seats };
  }),
};
```

---

## 8. UX Guidelines & Edge Case Handling

1. **Holding and Releasing**: With this column-span approach, releasing a hold only requires sending the single seat `id` back to the backend.
2. **Checkout Summary UI**:
   - In the Checkout sidebar or order confirmation screen, display couple seats clearly: `H1 (Couple)`.
   - The ticket count visually should reflect the physical count (i.e. 2 persons for 1 couple seat) if your business logic dictates that pricing/fees are per person. If pricing is strictly per-seat-entity, make sure to display it clearly so users understand the couple seat costs X.
3. **Responsive Scaling**: Since `col-span-2` naturally fits into a grid and resizes with the layout, responsive scaling is significantly smoother than the "bridged gap" approach. Ensure horizontal scrolling (`overflow-x-auto`) is still available for narrow mobile screens.
