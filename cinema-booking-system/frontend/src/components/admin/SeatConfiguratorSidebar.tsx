import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { MAX_GRID, MIN_GRID } from '../../hooks/useSeatConfigurator';
import { SeatType } from '../../types/booking';

interface SeatConfiguratorSidebarProps {
  activeTool: SeatType;
  rows: number;
  columns: number;
  onToolChange: (tool: SeatType) => void;
  onRowsChange: (value: number) => void;
  onColumnsChange: (value: number) => void;
}

const tools = [
  { id: 'standard', label: 'Standard Seat', hint: 'Green tile', border: 'border-transparent', bg: 'bg-green-500' },
  { id: 'vip', label: 'VIP Seat', hint: 'Gold tile', border: 'border-transparent', bg: 'bg-amber-400' },
  { id: 'couple', label: 'Couple Seat', hint: 'Pink tile, 2 cols', border: 'border-transparent', bg: 'bg-pink-500' },
] as const;

const DraggableTool: React.FC<{ tool: typeof tools[number]; activeTool: SeatType; onClick: () => void }> = ({ tool, activeTool, onClick }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: tool.id,
    data: { type: tool.id }
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      className={`w-full flex items-center justify-between p-4 rounded-xl border ${activeTool === tool.id ? 'border-primary bg-surface-container-low' : 'border-outline-variant/30 bg-white'} transition-colors cursor-grab active:cursor-grabbing`}
    >
      <div className="flex items-center gap-3 pointer-events-none">
        <span className={`w-6 h-6 rounded-sm ${tool.bg} border-2 ${tool.border} shadow-sm`}></span>
        <div className="text-left">
          <div className="text-sm font-semibold text-on-surface">{tool.label}</div>
          <div className="text-[10px] uppercase tracking-widest text-outline">{tool.hint}</div>
        </div>
      </div>
      <span className="text-[10px] uppercase tracking-widest text-primary pointer-events-none">
        {activeTool === tool.id ? 'Active' : 'Drag'}
      </span>
    </button>
  );
};

export const SeatConfiguratorSidebar: React.FC<SeatConfiguratorSidebarProps> = ({
  activeTool,
  rows,
  columns,
  onToolChange,
  onRowsChange,
  onColumnsChange,
}) => {
  return (
    <aside className="space-y-6">
      <section className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-outline mb-4">Tool Palette</h3>
        <div className="space-y-3">
          {tools.map((tool) => (
            <DraggableTool
              key={tool.id}
              tool={tool}
              activeTool={activeTool}
              onClick={() => onToolChange(tool.id as SeatType)}
            />
          ))}
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-outline mb-4">Grid Settings</h3>
        <div className="space-y-4">
          <label className="flex flex-col gap-2 text-xs font-semibold text-on-surface-variant">
            Rows
            <input
              type="number"
              min={MIN_GRID}
              max={MAX_GRID}
              value={rows}
              onChange={(event) => onRowsChange(Number(event.target.value))}
              className="w-full rounded-lg bg-surface-container-lowest border border-outline-variant/30 px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold text-on-surface-variant">
            Columns
            <input
              type="number"
              min={MIN_GRID}
              max={MAX_GRID}
              value={columns}
              onChange={(event) => onColumnsChange(Number(event.target.value))}
              className="w-full rounded-lg bg-surface-container-lowest border border-outline-variant/30 px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
            />
          </label>
          <div className="pt-2 text-[11px] text-on-surface-variant">
            Tip: Drag a seat type onto the grid or click to paint. Click the same seat to clear.
          </div>
        </div>
      </section>

      <section className="bg-inverse-surface text-white rounded-2xl p-6">
        <div className="text-[10px] uppercase tracking-widest text-slate-400">Seat Map Notes</div>
        <p className="text-xs leading-relaxed text-slate-200 mt-3">
          This layout mirrors the booking experience. Standard seats render in green, while VIP seats
          keep the amber outline for premium zones.
        </p>
      </section>
    </aside>
  );
};
