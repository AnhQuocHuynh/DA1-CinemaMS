import React from 'react';
import { SeatMap, Seat } from '../../types/booking';
import { useTranslation } from 'react-i18next';

interface SeatMapGridProps {
  seatMap: SeatMap;
  isSelected: (seat: Seat) => boolean;
  onSeatToggle: (seat: Seat) => void;
  fitToScreen?: boolean;
}

export const SeatMapGrid: React.FC<SeatMapGridProps> = ({
  seatMap,
  isSelected,
  onSeatToggle,
  fitToScreen = false,
}) => {
  const { t } = useTranslation();
  // Infer column count from the widest seat number
  const colCount = seatMap.rows.reduce(
    (max, row) => Math.max(
      max,
      row.seats.reduce((rowMax, s) => Math.max(rowMax, s.number), 0)
    ),
    1
  );

  const useTouchMinWidth = !fitToScreen && colCount > 7;

  return (
    <div
      className={`grid gap-1.5 sm:gap-2 max-w-3xl mx-auto ${useTouchMinWidth ? 'w-max min-w-full md:w-full' : 'w-full'}`}
      style={{
        gridTemplateColumns: useTouchMinWidth
          ? `repeat(${colCount}, minmax(36px, 1fr))`
          : `repeat(${colCount}, minmax(0, 1fr))`,
      }}
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
              baseClass = 'bg-yellow-200 ring-2 ring-gray-400 text-gray-900 shadow-md cursor-pointer';
            } else if (seat.type === 'vip') {
              baseClass = 'bg-gradient-to-br from-amber-200 to-amber-500 hover:from-amber-300 hover:to-amber-600 text-amber-950 border border-amber-600 shadow-sm transition-all cursor-pointer';
            } else if (seat.type === 'couple') {
              baseClass = 'bg-pink-500 hover:bg-pink-600 text-white transition-colors cursor-pointer';
            } else {
              baseClass = 'bg-success hover:bg-success text-white transition-colors cursor-pointer';
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
            const shapeClass = isCouple ? 'rounded-lg aspect-[2/1] w-full' : 'rounded-sm w-full aspect-square';

            const isDisabled = seat.status === 'sold' || seat.status === 'holding';
            return (
              <button
                key={seat.id}
                type="button"
                disabled={isDisabled}
                onClick={() => onSeatToggle(seat)}
                className={`${baseClass} ${shapeClass} ${spanClass} flex flex-col items-center justify-center ${
                  fitToScreen ? 'text-[8px] px-0.5' : 'text-[10px] sm:text-xs min-h-[36px] sm:min-h-0 px-0.5 sm:px-1'
                } font-bold min-w-0 overflow-hidden`}
                title={`${seat.label} • ${seat.type.toUpperCase()}`}
              >
                <span className={`${selected || seat.status === 'available' ? 'opacity-100' : 'opacity-40'} transition-opacity truncate w-full text-center leading-tight`}>
                  {seat.label}
                  {isCouple && <span className={`block ${fitToScreen ? 'text-[6px]' : 'text-[8px] sm:text-[9px]'} opacity-80`}>({t('seatMap.couple', 'Couple')})</span>}
                </span>
              </button>
            );
      })}
    </div>
  );
};
