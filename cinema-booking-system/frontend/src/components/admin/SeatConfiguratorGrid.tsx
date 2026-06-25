import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { getRowLabel, SeatCell } from '../../hooks/useSeatConfigurator';
import { SeatType } from '../../types/booking';

interface SeatConfiguratorGridProps {
  grid: SeatCell[][];
  columns: number;
  activeTool: SeatType;
  onCellUpdate: (rowIndex: number, colIndex: number, nextType: SeatType) => void;
}

const DroppableCell: React.FC<{
  cell: SeatCell;
  rowIndex: number;
  colIndex: number;
  activeTool: SeatType;
  onCellUpdate: (r: number, c: number, t: SeatType) => void;
}> = ({ cell, rowIndex, colIndex, activeTool, onCellUpdate }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `${rowIndex}-${colIndex}`,
    data: { rowIndex, colIndex }
  });

  if (cell.coveredByLeft) return null;

  const isVip = cell.type === 'vip';
  const isCouple = cell.type === 'couple';
  const cellLabel = cell.type ? `${getRowLabel(rowIndex)}${colIndex + 1}` : '';
  
  let cellClass = 'bg-surface-container-lowest/70 border border-dashed border-outline-variant/40 aspect-square text-outline-variant';
  if (cell.type) {
    if (isCouple) {
       cellClass = 'bg-pink-500 hover:bg-pink-600 border border-transparent col-span-2 aspect-[2/1] w-full text-white';
    } else if (isVip) {
       cellClass = 'bg-gradient-to-br from-amber-200 to-amber-500 hover:from-amber-300 hover:to-amber-600 border border-amber-600 shadow-sm w-full aspect-square text-amber-950';
    } else {
       cellClass = 'bg-green-500 hover:bg-green-600 border border-transparent w-full aspect-square text-white';
    }
  }

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onCellUpdate(rowIndex, colIndex, activeTool)}
      className={`${cellClass} ${isOver ? 'ring-2 ring-primary ring-offset-1 scale-105' : ''} rounded-sm flex items-center justify-center text-[8px] font-bold transition-all duration-200`}
      title={cell.type ? `${cellLabel} • ${cell.type.toUpperCase()}` : 'Empty'}
    >
      <span className={cell.type ? 'opacity-100' : 'opacity-0'}>{cellLabel}</span>
    </button>
  );
};

export const SeatConfiguratorGrid: React.FC<SeatConfiguratorGridProps> = ({
  grid,
  columns,
  activeTool,
  onCellUpdate,
}) => {
  return (
    <div
      className="grid gap-2 max-w-3xl mx-auto"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => (
          <DroppableCell
            key={cell.id}
            cell={cell}
            rowIndex={rowIndex}
            colIndex={colIndex}
            activeTool={activeTool}
            onCellUpdate={onCellUpdate}
          />
        ))
      )}
    </div>
  );
};
