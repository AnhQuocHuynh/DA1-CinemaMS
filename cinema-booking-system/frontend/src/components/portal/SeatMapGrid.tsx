import React from 'react';
import { SeatMap, Seat } from '../../types/booking';

interface SeatMapGridProps {
  seatMap: SeatMap;
  isSelected: (seat: Seat) => boolean;
  onSeatToggle: (seat: Seat) => void;
}

export const SeatMapGrid: React.FC<SeatMapGridProps> = ({ seatMap, isSelected, onSeatToggle }) => {
  // Infer column count from the widest seat number
  const colCount = seatMap.rows.reduce(
    (max, row) => Math.max(
      max,
      row.seats.reduce((rowMax, s) => Math.max(rowMax, s.number), 0)
    ),
    1
  );

  return (
    <div
      className="grid gap-2 max-w-3xl mx-auto w-full"
      style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
    >
      {seatMap.rows.flatMap((row) => {
        const cells = [];
        let skipUntil = 0;
        for (let i = 1; i <= colCount; i++) {
          if (i < skipUntil) continue;
          const seat = row.seats.find((s) => s.number === i);
          if (seat) {
            cells.push(seat);
            skipUntil = i + (seat.columnSpan || 1);
          } else {
            cells.push({ id: `gap-${row.rowLabel}-${i}`, isPathway: true } as any);
            skipUntil = i + 1;
          }
        }
        return cells;
      }).map((seat: Seat) => {
            const selected = isSelected(seat);
            let baseClass = '';
            if (seat.status === 'sold') {
              baseClass = 'bg-gray-400 cursor-not-allowed text-gray-200';
            } else if (seat.status === 'holding') {
              baseClass = 'bg-yellow-200 ring-2 ring-gray-400 cursor-wait text-gray-800';
            } else if (selected) {
              baseClass = 'bg-yellow-200 ring-2 ring-gray-400 text-gray-900 shadow-md';
            } else if (seat.type === 'vip') {
              baseClass = 'bg-gradient-to-br from-amber-200 to-amber-500 hover:from-amber-300 hover:to-amber-600 text-amber-950 border border-amber-600 shadow-sm transition-all cursor-pointer';
            } else {
              baseClass = 'bg-green-500 hover:bg-green-600 text-white transition-colors cursor-pointer';
            }

            if (seat.isPathway) {
              return (
                <div
                  key={seat.id}
                  className="w-full aspect-square rounded-sm bg-transparent"
                  aria-hidden="true"
                />
              );
            }

            const isCouple = seat.type === 'couple';
            const spanClass = isCouple ? 'col-span-2' : 'col-span-1';
            const shapeClass = isCouple ? 'bg-pink-500 hover:bg-pink-600 rounded-lg aspect-[2/1] w-full' : 'rounded-sm w-full aspect-square';

            const isDisabled = seat.status === 'sold' || seat.status === 'holding';
            return (
              <button
                key={seat.id}
                type="button"
                disabled={isDisabled}
                onClick={() => onSeatToggle(seat)}
                className={`${baseClass} ${shapeClass} ${spanClass} flex flex-col items-center justify-center text-[8px] font-bold min-w-0 overflow-hidden px-1`}
                title={`${seat.label} • ${seat.type.toUpperCase()}`}
              >
                <span className={`${selected || seat.status === 'available' ? 'opacity-100' : 'opacity-40'} transition-opacity truncate w-full text-center leading-tight`}>
                  {seat.label}
                  {isCouple && <span className="block text-[6px] opacity-80">(Couple)</span>}
                </span>
              </button>
            );
      })}
    </div>
  );
};
