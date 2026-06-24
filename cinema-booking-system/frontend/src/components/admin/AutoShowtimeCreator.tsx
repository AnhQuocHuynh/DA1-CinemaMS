import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Film,
  Loader2,
  Play,
  Plus,
  Trash2,
  Wand2,
  X,
  ZapOff,
} from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { MovieResponse, movieService } from '../../services/movieService';
import { showtimeService } from '../../services/showtimeService';
import { adminService } from '../../services/adminService';
import { useAutoShowtime } from '../../hooks/useAutoShowtime';
import { COLOUR_CLASSES, toHHMM, toMinutes } from '../../utils/scheduleUtils';
import { ScheduleConstraints, ScheduledMovie, ShowtimeBlock } from '../../types/schedule';
import { ShowtimeResponse } from '../../types/showtime';

// ── Default constraints ───────────────────────────────────────────────────────
const DEFAULT_CONSTRAINTS: ScheduleConstraints = {
  openTime: '08:00',
  closeTime: '23:00',
  cleaningTimeMinutes: 15,
  adsTimeMinutes: 10,
};

// ── Utility ───────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

function existingToBlock(st: ShowtimeResponse, open: number): ShowtimeBlock {
  const startHHMM = st.startTime.slice(11, 16);
  const endHHMM   = st.endTime.slice(11, 16);
  const startMin  = toMinutes(startHHMM);
  const endMin    = toMinutes(endHHMM);
  return {
    id:            `existing-${st.id}`,
    movieId:       st.movieId ?? undefined,
    eventId:       st.eventId ?? undefined,
    title:         st.movieId ? `Movie #${st.movieId}` : st.eventId ? `Event #${st.eventId}` : 'Showtime',
    startTime:     startHHMM,
    endTime:       endHHMM,
    totalMinutes:  endMin - startMin,
    colorClass:    'bg-slate-500',
    isLocked:      true,
    isConflict:    false,
    offsetMinutes: startMin - open,
  };
}

// ── DraggableBlock ────────────────────────────────────────────────────────────
// Uses @dnd-kit/core `useDraggable` — replaces the raw mousedown/mousemove impl.

interface DraggableBlockProps {
  block: ShowtimeBlock;
  totalMinutes: number;
  onRemove?: (id: string) => void;
  /** Pixel offset applied while actively dragging (supplied by DndContext via onDragMove). */
  liveTranslateX?: number;
}

const DraggableBlock: React.FC<DraggableBlockProps> = ({
  block,
  totalMinutes,
  onRemove,
  liveTranslateX = 0,
}) => {
  const widthPct = (block.totalMinutes / totalMinutes) * 100;
  const leftPct  = (block.offsetMinutes / totalMinutes) * 100;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id:       block.id,
    disabled: block.isLocked,
    data:     { block },
  });

  const baseClass = block.isConflict
    ? 'bg-red-500 border-2 border-red-700'
    : block.isLocked
    ? 'bg-slate-400 border border-slate-500'
    : `${block.colorClass} border border-white/20`;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`absolute top-2 bottom-2 rounded-md overflow-hidden select-none group transition-opacity
        ${block.isLocked ? 'cursor-default' : isDragging ? 'opacity-40 cursor-grabbing z-30' : 'cursor-grab z-10 hover:brightness-110'}
        ${baseClass}`}
      style={{
        left:      `${leftPct}%`,
        width:     `${Math.max(widthPct, 0.5)}%`,
        transform: isDragging ? `translateX(${liveTranslateX}px)` : undefined,
      }}
      title={`${block.title} | ${block.startTime}–${block.endTime}`}
    >
      <div className="flex flex-col justify-between h-full px-2 py-1 text-white pointer-events-none">
        <span className="text-[10px] font-bold leading-tight line-clamp-1">{block.title}</span>
        <span className="text-[9px] opacity-80">{block.startTime}–{block.endTime}</span>
      </div>

      {block.isConflict && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-600/60 pointer-events-none">
          <AlertTriangle size={14} className="text-white" />
        </div>
      )}

      {!block.isLocked && onRemove && (
        <button
          onPointerDown={(e) => e.stopPropagation()} // prevent drag from firing on delete
          onClick={() => onRemove(block.id)}
          className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center bg-black/30 rounded hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity z-20"
        >
          <X size={9} />
        </button>
      )}
    </div>
  );
};

// ── DragOverlay ghost ─────────────────────────────────────────────────────────

const BlockGhost: React.FC<{ block: ShowtimeBlock; totalMinutes: number }> = ({ block, totalMinutes }) => {
  const widthPct = (block.totalMinutes / totalMinutes) * 100;
  return (
    <div
      className={`rounded-md h-20 ${block.colorClass} opacity-80 shadow-2xl border border-white/30`}
      style={{ width: `${Math.max(widthPct, 2)}%`, minWidth: '60px' }}
    >
      <div className="flex flex-col justify-between h-full px-2 py-1 text-white">
        <span className="text-[10px] font-bold leading-tight line-clamp-1">{block.title}</span>
        <span className="text-[9px] opacity-80">{block.startTime}–{block.endTime}</span>
      </div>
    </div>
  );
};

// ── Movie selector row ────────────────────────────────────────────────────────

interface MovieSelectorRowProps {
  movie: MovieResponse;
  selected: ScheduledMovie | undefined;
  colorClass: string;
  onToggle: (movie: MovieResponse, colorClass: string) => void;
  onPriorityChange: (movieId: number, priority: number) => void;
}

const MovieSelectorRow: React.FC<MovieSelectorRowProps> = ({
  movie, selected, colorClass, onToggle, onPriorityChange,
}) => {
  const isSelected = !!selected;
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer
        ${isSelected ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
      onClick={() => onToggle(movie, colorClass)}
    >
      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${colorClass}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{movie.title}</p>
        <p className="text-xs text-slate-500">{movie.durationMinutes} min</p>
      </div>
      {isSelected && (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <span className="text-xs text-slate-500 font-medium">×</span>
          <button
            className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200"
            onClick={() => onPriorityChange(movie.id, Math.max(1, selected.priority - 1))}
          >
            <ChevronDown size={12} />
          </button>
          <span className="text-xs font-bold text-blue-600 w-4 text-center">{selected.priority}</span>
          <button
            className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200"
            onClick={() => onPriorityChange(movie.id, Math.min(8, selected.priority + 1))}
          >
            <ChevronUp size={12} />
          </button>
        </div>
      )}
      {isSelected ? (
        <Check size={14} className="text-blue-600 flex-shrink-0" />
      ) : (
        <Plus size={14} className="text-slate-400 flex-shrink-0" />
      )}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

interface AutoShowtimeCreatorProps {
  onClose: () => void;
}

export const AutoShowtimeCreator: React.FC<AutoShowtimeCreatorProps> = ({ onClose }) => {
  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate]     = useState(today());
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [basePrice, setBasePrice]           = useState<number>(85000);
  const [constraints, setConstraints]       = useState<ScheduleConstraints>(DEFAULT_CONSTRAINTS);
  const [selectedMovies, setSelectedMovies] = useState<ScheduledMovie[]>([]);
  const [availableMovies, setAvailableMovies] = useState<MovieResponse[]>([]);
  const [theaters, setTheaters]             = useState<{ id: string; name: string; rooms: { id: string; name: string }[] }[]>([]);
  const [existingBlocks, setExistingBlocks] = useState<ShowtimeBlock[]>([]);
  const [isLoadingMovies, setIsLoadingMovies]   = useState(false);
  const [isLoadingRooms, setIsLoadingRooms]     = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);

  // Tracks the active dragging block id and the live pixel delta during drag
  const [activeDragId, setActiveDragId]         = useState<string | null>(null);
  const [liveDragDeltaX, setLiveDragDeltaX]     = useState(0);
  const timelineRef                             = useRef<HTMLDivElement>(null);

  const {
    blocks, isPublishing, publishError, publishSuccess,
    autoFill, clearBlocks, moveBlock, removeBlock, publishSchedule,
  } = useAutoShowtime();

  // ── dnd-kit sensors ───────────────────────────────────────────────────────
  // MouseSensor + TouchSensor give us both desktop and mobile drag support.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor,  { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setIsLoadingMovies(true);
    movieService.getMovies()
      .then(setAvailableMovies).catch(console.error)
      .finally(() => setIsLoadingMovies(false));
  }, []);

  useEffect(() => {
    setIsLoadingRooms(true);
    adminService.getTheaters()
      .then(setTheaters).catch(console.error)
      .finally(() => setIsLoadingRooms(false));
  }, []);

  useEffect(() => {
    if (!selectedRoomId) { setExistingBlocks([]); return; }
    setIsLoadingExisting(true);
    showtimeService.getShowtimesByRoom(selectedRoomId)
      .then((showtimes) => {
        const open      = toMinutes(constraints.openTime);
        const dayBlocks = showtimes
          .filter((st) => st.startTime.startsWith(selectedDate))
          .map((st) => existingToBlock(st, open));
        setExistingBlocks(dayBlocks);
      })
      .catch(console.error)
      .finally(() => setIsLoadingExisting(false));
  }, [selectedRoomId, selectedDate, constraints.openTime]);

  // ── Derived values ────────────────────────────────────────────────────────
  const openMin              = toMinutes(constraints.openTime);
  const closeMin             = toMinutes(constraints.closeTime);
  const totalOperatingMinutes = Math.max(closeMin - openMin, 1);
  const allBlocks: ShowtimeBlock[] = [...existingBlocks, ...blocks];
  const hasConflicts         = blocks.some((b) => b.isConflict);
  const utilizationMinutes   = blocks.reduce((acc, b) => acc + b.totalMinutes, 0);
  const utilizationPct       = Math.round((utilizationMinutes / totalOperatingMinutes) * 100);

  const activeBlock = activeDragId ? allBlocks.find((b) => b.id === activeDragId) : null;

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
    setLiveDragDeltaX(0);
  };

  /**
   * During drag we keep track of the raw pixel delta so the dragged block
   * visually follows the cursor before we commit the new position on drop.
   */
  const handleDragMove = (event: DragMoveEvent) => {
    setLiveDragDeltaX(event.delta.x);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    setLiveDragDeltaX(0);

    const { active, delta } = event;
    if (!delta.x || !timelineRef.current) return;

    const blockId     = active.id as string;
    const dragged     = allBlocks.find((b) => b.id === blockId);
    if (!dragged || dragged.isLocked) return;

    const parentWidth = timelineRef.current.getBoundingClientRect().width;
    const deltaMinutes = (delta.x / parentWidth) * totalOperatingMinutes;
    // Snap to 5-minute grid
    const rawOffset    = dragged.offsetMinutes + deltaMinutes;
    const snapped      = Math.round(rawOffset / 5) * 5;
    const clamped      = Math.max(0, Math.min(snapped, totalOperatingMinutes - dragged.totalMinutes));
    const newStart     = toHHMM(openMin + clamped);

    moveBlock(blockId, newStart, constraints, existingBlocks);
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setLiveDragDeltaX(0);
  };

  // ── Other handlers ────────────────────────────────────────────────────────
  const toggleMovie = useCallback((movie: MovieResponse, colorClass: string) => {
    setSelectedMovies((prev) => {
      const exists = prev.find((m) => m.id === movie.id);
      if (exists) return prev.filter((m) => m.id !== movie.id);
      return [...prev, { id: movie.id, title: movie.title, durationMinutes: movie.durationMinutes, priority: 1, colorClass }];
    });
  }, []);

  const setPriority = useCallback((movieId: number, priority: number) => {
    setSelectedMovies((prev) => prev.map((m) => (m.id === movieId ? { ...m, priority } : m)));
  }, []);

  // ── Timeline tick marks ───────────────────────────────────────────────────
  const ticks: { pct: number; label: string }[] = [];
  for (let m = 0; m <= totalOperatingMinutes; m += 60) {
    ticks.push({ pct: (m / totalOperatingMinutes) * 100, label: toHHMM(openMin + m) });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/70 backdrop-blur-sm overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl min-h-[90vh] flex flex-col">

        {/* Header */}
        <header className="px-8 py-5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Wand2 size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Auto Showtime Creator</h2>
              <p className="text-xs text-slate-500">Greedy schedule packing · drag &amp; drop to refine · powered by dnd-kit</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
            <X size={20} />
          </button>
        </header>

        <div className="flex flex-1 min-h-0">

          {/* ── Sidebar ───────────────────────────────────────────────── */}
          <aside className="w-80 flex-shrink-0 border-r border-slate-200 flex flex-col overflow-y-auto">

            {/* Context */}
            <section className="p-6 border-b border-slate-100">
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4">Context</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                  <input type="date" value={selectedDate} min={today()}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Room</label>
                  {isLoadingRooms ? (
                    <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 size={14} className="animate-spin" /> Loading...</div>
                  ) : (
                    <select value={selectedRoomId ?? ''}
                      onChange={(e) => setSelectedRoomId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                      <option value="">— Select a room —</option>
                      {theaters.map((t) => t.rooms.map((r) => (
                        <option key={r.id} value={r.id}>{t.name} › {r.name}</option>
                      )))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Base Ticket Price (VND)</label>
                  <input type="number" value={basePrice} min={0} step={5000}
                    onChange={(e) => setBasePrice(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
            </section>

            {/* Operating window */}
            <section className="p-6 border-b border-slate-100">
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4">Operating Window</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Open', key: 'openTime' as const, type: 'time' },
                  { label: 'Close', key: 'closeTime' as const, type: 'time' },
                  { label: 'Ads (min)', key: 'adsTimeMinutes' as const, type: 'number' },
                  { label: 'Cleaning (min)', key: 'cleaningTimeMinutes' as const, type: 'number' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                    <input type={type} value={constraints[key]} min={type === 'number' ? 0 : undefined}
                      onChange={(e) => setConstraints((c) => ({ ...c, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                ))}
              </div>
            </section>

            {/* Movie pool */}
            <section className="p-6 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400">Movie Pool</h3>
                {selectedMovies.length > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">{selectedMovies.length} selected</span>
                )}
              </div>
              {isLoadingMovies ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 size={14} className="animate-spin" /> Loading movies...</div>
              ) : availableMovies.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Film size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No active movies found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableMovies.map((movie, idx) => {
                    const colorClass = COLOUR_CLASSES[idx % COLOUR_CLASSES.length];
                    return (
                      <MovieSelectorRow key={movie.id} movie={movie}
                        selected={selectedMovies.find((m) => m.id === movie.id)}
                        colorClass={colorClass} onToggle={toggleMovie} onPriorityChange={setPriority} />
                    );
                  })}
                </div>
              )}
            </section>

            {/* Actions */}
            <footer className="p-6 border-t border-slate-200 space-y-3">
              <button onClick={() => autoFill(selectedMovies, constraints, existingBlocks)}
                disabled={!selectedRoomId || selectedMovies.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <Wand2 size={16} /> Auto-Fill Schedule
              </button>
              <button onClick={clearBlocks} disabled={blocks.length === 0}
                className="w-full flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold rounded-xl py-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm">
                <ZapOff size={14} /> Clear Generated Blocks
              </button>
            </footer>
          </aside>

          {/* ── Main canvas ───────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Clock size={14} />
                  Timeline — {selectedDate}
                  {isLoadingExisting && <Loader2 size={12} className="animate-spin text-slate-400" />}
                </h3>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-400 inline-block" /> Existing</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Generated</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Conflict</span>
                </div>
              </div>

              {/* ── dnd-kit DndContext wraps the timeline ─────────────── */}
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                {/* Timeline row */}
                <div
                  ref={timelineRef}
                  className="relative rounded-xl border border-slate-200 bg-slate-50 overflow-hidden"
                  style={{ height: '120px' }}
                >
                  {/* Hour grid lines */}
                  {ticks.map((tick) => (
                    <div key={tick.label} className="absolute top-0 bottom-0 border-l border-slate-200"
                      style={{ left: `${tick.pct}%` }} />
                  ))}

                  {/* All blocks */}
                  {allBlocks.map((block) => (
                    <DraggableBlock
                      key={block.id}
                      block={block}
                      totalMinutes={totalOperatingMinutes}
                      onRemove={!block.isLocked ? removeBlock : undefined}
                      liveTranslateX={activeDragId === block.id ? liveDragDeltaX : 0}
                    />
                  ))}

                  {allBlocks.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                      <div className="text-center">
                        <Play size={28} className="mx-auto mb-1 opacity-30" />
                        <p className="text-xs">Select movies and click Auto-Fill to generate a schedule</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* DragOverlay: renders a floating ghost while dragging */}
                <DragOverlay dropAnimation={null}>
                  {activeBlock && !activeBlock.isLocked ? (
                    <BlockGhost block={activeBlock} totalMinutes={totalOperatingMinutes} />
                  ) : null}
                </DragOverlay>
              </DndContext>

              {/* Time axis */}
              <div className="relative h-6 mt-1">
                {ticks.map((tick) => (
                  <span key={tick.label} className="absolute text-[10px] text-slate-400 -translate-x-1/2"
                    style={{ left: `${tick.pct}%` }}>
                    {tick.label}
                  </span>
                ))}
              </div>

              {/* Generated blocks table */}
              {blocks.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Generated Screenings</h3>
                  <div className="rounded-xl overflow-hidden border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {['Movie', 'Start', 'End', 'Duration', 'Status', ''].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-[10px] uppercase font-bold text-slate-400 tracking-widest">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {blocks.map((block) => (
                          <tr key={block.id} className={block.isConflict ? 'bg-red-50' : 'bg-white'}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${block.colorClass}`} />
                                <span className="font-medium text-slate-800">{block.title}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-mono">{block.startTime}</td>
                            <td className="px-4 py-3 text-slate-600 font-mono">{block.endTime}</td>
                            <td className="px-4 py-3 text-slate-500">{block.movieDurationMinutes} min</td>
                            <td className="px-4 py-3">
                              {block.isConflict ? (
                                <span className="flex items-center gap-1 text-red-600 text-xs font-bold"><AlertTriangle size={11} /> Conflict</span>
                              ) : (
                                <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold"><Check size={11} /> OK</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => removeBlock(block.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Summary + Publish bar */}
            <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between gap-6 flex-shrink-0 bg-slate-50">
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Screenings</p>
                  <p className="text-2xl font-black text-slate-800">{blocks.length}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Utilization</p>
                  <p className="text-2xl font-black text-slate-800">{utilizationPct}%</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Validation</p>
                  {hasConflicts ? (
                    <p className="text-sm font-bold text-red-500 flex items-center gap-1">
                      <AlertTriangle size={13} /> {blocks.filter((b) => b.isConflict).length} conflict(s)
                    </p>
                  ) : blocks.length > 0 ? (
                    <p className="text-sm font-bold text-emerald-600 flex items-center gap-1"><Check size={13} /> Valid</p>
                  ) : (
                    <p className="text-sm text-slate-400">—</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                {publishError && (
                  <span className="text-sm text-red-600 font-medium flex items-center gap-1">
                    <AlertTriangle size={14} /> {publishError}
                  </span>
                )}
                {publishSuccess && (
                  <span className="text-sm text-emerald-600 font-semibold flex items-center gap-1">
                    <Check size={14} /> Published successfully!
                  </span>
                )}
                <button
                  onClick={() => { if (selectedRoomId) publishSchedule(selectedRoomId, selectedDate, basePrice, constraints); }}
                  disabled={blocks.length === 0 || !selectedRoomId || hasConflicts || isPublishing}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md">
                  {isPublishing ? (
                    <><Loader2 size={16} className="animate-spin" /> Publishing…</>
                  ) : (
                    <><Check size={16} /> Save &amp; Publish</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
