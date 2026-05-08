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
          const selected = isSelected(seat);
          const isDisabled = seat.status === 'sold' || seat.status === 'holding';
          const baseClass = seat.status === 'sold'
            ? 'bg-secondary-container opacity-50 cursor-not-allowed'
            : seat.status === 'holding'
              ? 'bg-tertiary-container cursor-wait'
              : selected
                ? 'bg-primary text-white ring-2 ring-primary ring-offset-2'
                : 'bg-primary-fixed hover:bg-primary transition-colors cursor-pointer';

          return (
            <button
              key={seat.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onSeatToggle(seat)}
              className={`${baseClass} w-full aspect-square rounded-sm flex items-center justify-center text-[8px] font-bold`}
              title={seat.label}
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
