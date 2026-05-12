import React from 'react';
import { getRowLabel, SeatCell } from '../../hooks/useSeatConfigurator';
import { SeatType } from '../../types/booking';

interface SeatConfiguratorGridProps {
  grid: SeatCell[][];
  columns: number;
  activeTool: SeatType;
  onCellUpdate: (rowIndex: number, colIndex: number, nextType: SeatType) => void;
  onDrop: (rowIndex: number, colIndex: number, event: React.DragEvent<HTMLButtonElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLButtonElement>) => void;
}

export const SeatConfiguratorGrid: React.FC<SeatConfiguratorGridProps> = ({
  grid,
  columns,
  activeTool,
  onCellUpdate,
  onDrop,
  onDragOver,
}) => {
  return (
    <div
      className="grid gap-2 max-w-3xl mx-auto"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const isVip = cell.type === 'vip';
          const cellLabel = cell.type ? `${getRowLabel(rowIndex)}${colIndex + 1}` : '';
          const cellClass = cell.type
            ? `bg-green-500 hover:bg-green-600 ${isVip ? 'border-2 border-amber-400' : 'border border-transparent'}`
            : 'bg-surface-container-lowest/70 border border-dashed border-outline-variant/40';

          return (
            <button
              key={cell.id}
              type="button"
              onClick={() => onCellUpdate(rowIndex, colIndex, activeTool)}
              onDragOver={onDragOver}
              onDrop={(event) => onDrop(rowIndex, colIndex, event)}
              className={`${cellClass} w-full aspect-square rounded-sm flex items-center justify-center text-[8px] font-bold text-white/90 transition-colors`}
              title={cell.type ? `${cellLabel} • ${cell.type.toUpperCase()}` : 'Empty'}
            >
              <span className={cell.type ? 'opacity-100' : 'opacity-0'}>{cellLabel}</span>
            </button>
          );
        })
      )}
    </div>
  );
};
