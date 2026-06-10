import React from 'react';
import { SeatMap, Seat } from '../../types/booking';

interface SeatMapGridProps {
  seatMap: SeatMap;
  isSelected: (seat: Seat) => boolean;
  onSeatToggle: (seat: Seat) => void;
}

export const SeatMapGrid: React.FC<SeatMapGridProps> = ({ seatMap, isSelected, onSeatToggle }) => {
  // Infer column count from the widest row (backend can vary per room)
  const colCount = seatMap.rows.reduce((max, row) => Math.max(max, row.seats.length), 1);

  return (
    <div
      className="grid gap-2 max-w-3xl mx-auto"
      style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
    >
      {seatMap.rows.flatMap((row) =>
        row.seats.map((seat) => {
          const selected = isSelected(seat);
          const isDisabled = seat.status === 'sold' || seat.status === 'holding';
          const baseClass = seat.status === 'sold'
            ? 'bg-gray-400 cursor-not-allowed'
            : seat.status === 'holding'
              ? 'bg-yellow-400 ring-2 ring-gray-400 cursor-wait'
              : selected
                ? 'bg-yellow-400 ring-2 ring-gray-400 text-gray-900'
                : 'bg-green-500 hover:bg-green-600 transition-colors cursor-pointer';
            if (seat.isPathway) {
              return (
                <div
                  key={seat.id}
                  className="w-full aspect-square rounded-sm bg-transparent"
                  aria-hidden="true"
                />
              );
            }

          const vipClass = seat.type === 'vip' ? 'border-2 border-amber-400' : 'border border-transparent';

          return (
            <button
              key={seat.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onSeatToggle(seat)}
              className={`${baseClass} ${vipClass} w-full aspect-square rounded-sm flex items-center justify-center text-[8px] font-bold`}
                title={`${seat.label} • ${seat.type.toUpperCase()}`}
            >
              <span className={`${selected ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
                {seat.label}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
};
