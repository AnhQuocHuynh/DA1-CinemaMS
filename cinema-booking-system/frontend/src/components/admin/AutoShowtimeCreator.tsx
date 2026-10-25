import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Film,
  Flame,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Save,
  Star,
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
import { useScheduleStorage } from '../../hooks/useScheduleStorage';
import dayjs from 'dayjs';
import { COLOUR_CLASSES, getOperatingRange, toHHMM, toMinutes } from '../../utils/scheduleUtils';
import { CachedMoviePriority, ScheduledMovie, ShowtimeBlock } from '../../types/schedule';
import { ShowtimeResponse } from '../../types/showtime';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';

// ── Utility ───────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

function existingToBlock(
  st: ShowtimeResponse,
  openISO: string,
  movieMap?: Record<number, string>
): ShowtimeBlock {
  const startDayjs = dayjs(st.startTime);
  const openDayjs = dayjs(openISO);
  const offsetMinutes = startDayjs.diff(openDayjs, 'minute');
  const totalMinutes = dayjs(st.endTime).diff(startDayjs, 'minute');

  const movieTitle = st.displayTitle
    || (st.movieId && movieMap ? movieMap[st.movieId] : undefined)
    || (st.movieId ? `Movie #${st.movieId}` : undefined);
  const eventTitle = st.eventName || st.displayTitle || (st.eventId ? `Event #${st.eventId}` : undefined);

  return {
    id: `existing-${st.id}`,
    movieId: st.movieId ?? undefined,
    eventId: st.eventId ?? undefined,
    title: movieTitle || eventTitle || 'Showtime',
    startTime: st.startTime.slice(11, 16),
    endTime: st.endTime.slice(11, 16),
    totalMinutes,
    colorClass: 'bg-slate-500',
    isLocked: true,
    isConflict: false,
    offsetMinutes,
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
  const leftPct = (block.offsetMinutes / totalMinutes) * 100;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: block.id,
    disabled: block.isLocked,
    data: { block },
  });

  const baseClass = block.isConflict
    ? 'bg-error border-2 border-red-700'
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
        left: `${leftPct}%`,
        width: `${Math.max(widthPct, 0.5)}%`,
        transform: isDragging ? `translateX(${liveTranslateX}px)` : undefined,
      }}
      title={`${block.title} | ${block.startTime}–${block.endTime}`}
    >
      <div className="flex flex-col justify-between h-full px-2 py-1 text-white pointer-events-none">
        <span className="text-[10px] font-bold leading-tight line-clamp-1">{block.title}</span>
        <span className="text-[9px] opacity-80">{block.startTime}–{block.endTime}</span>
      </div>

      {block.isConflict && (
        <div className="absolute inset-0 flex items-center justify-center bg-error/60 pointer-events-none">
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
  cachedPriority?: CachedMoviePriority;
  selectedDate?: string;
  dateMode?: 'single' | 'range';
  endDate?: string;
  onToggle: (movie: MovieResponse, colorClass: string) => void;
  onPriorityChange: (movieId: number, priority: number) => void;
  onHotToggle: (movieId: number, isHot: boolean) => void;
}

const MovieSelectorRow: React.FC<MovieSelectorRowProps> = ({
  movie,
  selected,
  colorClass,
  cachedPriority,
  selectedDate,
  dateMode = 'single',
  endDate,
  onToggle,
  onPriorityChange,
  onHotToggle,
}) => {
  const isSelected = !!selected;
  const isRange = dateMode === 'range';
  const effectiveRefDate = isRange && endDate ? endDate : selectedDate;

  // Fully unreleased: cannot be shown even by the end of the range
  const isUnreleased = movie.releaseDate && effectiveRefDate
    ? dayjs(effectiveRefDate).isBefore(dayjs(movie.releaseDate), 'day')
    : false;

  // Releases mid-range: unreleased on selectedDate, but will be released before or on endDate
  const isPartiallyAvailable = isRange && movie.releaseDate && selectedDate && endDate
    ? dayjs(selectedDate).isBefore(dayjs(movie.releaseDate), 'day') && !dayjs(endDate).isBefore(dayjs(movie.releaseDate), 'day')
    : false;

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all
        ${isUnreleased
          ? 'opacity-60 bg-surface-container-low border-dashed border-outline-variant cursor-not-allowed'
          : isSelected
            ? 'border-blue-400 bg-highlight cursor-pointer'
            : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low cursor-pointer'}`}
      onClick={() => onToggle(movie, colorClass)}
    >
      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${colorClass}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold text-on-surface truncate">{movie.title}</p>
          {isUnreleased && (
            <span
              className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-bold flex-shrink-0"
              title={`Releases on ${dayjs(movie.releaseDate).format('YYYY-MM-DD')}`}
            >
              Upcoming ({dayjs(movie.releaseDate).format('YYYY-MM-DD')})
            </span>
          )}
          {isPartiallyAvailable && (
            <span
              className="text-[10px] text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded font-bold flex-shrink-0"
              title={`Becomes available on ${dayjs(movie.releaseDate).format('YYYY-MM-DD')}`}
            >
              From {dayjs(movie.releaseDate).format('MM-DD')}
            </span>
          )}
          {!isSelected && !isUnreleased && cachedPriority?.isHot && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-rose-500 bg-rose-500/10 px-1 py-0.2 rounded flex-shrink-0">
              <Flame size={9} className="fill-rose-500" /> HOT
            </span>
          )}
        </div>
        <p className="text-xs text-on-surface-variant">{movie.durationMinutes} min</p>
      </div>

      {isSelected && !isUnreleased && (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Priority Star Rating (1 to 3 stars) */}
          <div className="flex items-center bg-surface-container rounded px-1 py-0.5" title="Priority Weight (1=Standard, 2=High Demand, 3=Prime/Blockbuster)">
            {[1, 2, 3].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => onPriorityChange(movie.id, star)}
                className={`p-0.5 rounded transition-colors ${
                  selected.priority >= star
                    ? 'text-amber-400 hover:text-amber-300'
                    : 'text-outline-variant hover:text-on-surface-variant'
                }`}
                title={`Priority ${star}: ${star === 3 ? 'Blockbuster (3x weight)' : star === 2 ? 'High Demand (2x weight)' : 'Standard (1x weight)'}`}
              >
                <Star size={11} fill={selected.priority >= star ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>

          {/* Hot Movie Toggle */}
          <button
            type="button"
            onClick={() => onHotToggle(movie.id, !selected.isHot)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 transition-all ${
              selected.isHot
                ? 'bg-rose-500 text-white shadow-sm ring-1 ring-rose-400'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
            title={selected.isHot ? 'Featured Hot Movie (Golden Hours Dual-Screening)' : 'Mark as Hot for Golden Hours'}
          >
            <Flame size={11} className={selected.isHot ? 'text-amber-200 fill-amber-200' : ''} />
            <span>{selected.isHot ? 'HOT' : 'Hot'}</span>
          </button>
        </div>
      )}

      {isUnreleased ? (
        <span className="text-[11px] font-semibold text-on-surface-variant flex-shrink-0">Upcoming</span>
      ) : isSelected ? (
        <Check size={14} className="text-primary flex-shrink-0" />
      ) : (
        <Plus size={14} className="text-on-surface-variant flex-shrink-0" />
      )}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

interface AutoShowtimeCreatorProps {
  onClose: () => void;
}

export const AutoShowtimeCreator: React.FC<AutoShowtimeCreatorProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { addToast } = useToast();

  // ── Browser Cache Hook ────────────────────────────────────────────────────
  const {
    constraints,
    setConstraints,
    saveConstraints,
    resetConstraints,
    moviePriorities,
    setMoviePriority,
  } = useScheduleStorage();

  const [presetSaved, setPresetSaved] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    count: number;
    roomName: string;
    theaterName: string;
    date: string;
    rangeDays?: number;
  } | null>(null);
  const [countdown, setCountdown] = useState<number>(4);

  // ── Date Mode & State ─────────────────────────────────────────────────────
  const [dateMode, setDateMode] = useState<'single' | 'range'>('single');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(dayjs(today()).add(6, 'day').format('YYYY-MM-DD'));
  const [selectedDate, setSelectedDate] = useState(today()); // active day shown on timeline

  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [basePrice, setBasePrice] = useState<number>(85000);
  const [selectedMovies, setSelectedMovies] = useState<ScheduledMovie[]>([]);
  const [availableMovies, setAvailableMovies] = useState<MovieResponse[]>([]);
  const [theaters, setTheaters] = useState<{ id: string; name: string; rooms: { id: string; name: string }[] }[]>([]);
  const [rawRoomShowtimes, setRawRoomShowtimes] = useState<ShowtimeResponse[]>([]);
  const [isLoadingMovies, setIsLoadingMovies] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);

  // Tracks the active dragging block id and the live pixel delta during drag
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [liveDragDeltaX, setLiveDragDeltaX] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Compute list of dates in the range (up to 14 days max)
  const dateList = useMemo(() => {
    if (dateMode === 'single') return [startDate];
    const dates: string[] = [];
    let curr = dayjs(startDate);
    const end = dayjs(endDate).isBefore(curr) ? curr : dayjs(endDate);
    const maxDays = 14;
    let count = 0;
    while ((curr.isBefore(end, 'day') || curr.isSame(end, 'day')) && count < maxDays) {
      dates.push(curr.format('YYYY-MM-DD'));
      curr = curr.add(1, 'day');
      count++;
    }
    return dates.length > 0 ? dates : [startDate];
  }, [dateMode, startDate, endDate]);

  // Keep selectedDate within dateList
  useEffect(() => {
    if (!dateList.includes(selectedDate)) {
      setSelectedDate(dateList[0]);
    }
  }, [dateList, selectedDate]);

  const {
    blocks, dailyBlocks, isPublishing, publishProgress, publishError, publishSuccess,
    autoFill, autoFillDays, clearBlocks, clearAllDays, moveBlock, removeBlock, publishSchedule, publishMultiDay,
  } = useAutoShowtime(selectedDate);

  // ── dnd-kit sensors ───────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setIsLoadingMovies(true);
    movieService.getMovies()
      .then(setAvailableMovies)
      .catch(console.error)
      .finally(() => setIsLoadingMovies(false));
  }, []);

  useEffect(() => {
    setIsLoadingRooms(true);
    adminService.getTheaters()
      .then(setTheaters)
      .catch(console.error)
      .finally(() => setIsLoadingRooms(false));
  }, []);

  const movieMap = useMemo(() => {
    const map: Record<number, string> = {};
    availableMovies.forEach((m) => {
      map[m.id] = m.title;
    });
    return map;
  }, [availableMovies]);

  // Prune any selected movies that are unreleased on the entire selected date range
  useEffect(() => {
    setSelectedMovies((prev) => {
      const valid = prev.filter((m) => {
        const full = availableMovies.find((am) => am.id === m.id);
        if (!full?.releaseDate) return true;
        const refDate = dateMode === 'range' ? endDate : startDate;
        return !dayjs(refDate).isBefore(dayjs(full.releaseDate), 'day');
      });
      return valid;
    });
  }, [dateMode, startDate, endDate, availableMovies]);

  // Fetch showtimes for selected room
  useEffect(() => {
    if (!selectedRoomId) { setRawRoomShowtimes([]); return; }
    setIsLoadingExisting(true);
    showtimeService.getShowtimesByRoom(selectedRoomId)
      .then(setRawRoomShowtimes)
      .catch(console.error)
      .finally(() => setIsLoadingExisting(false));
  }, [selectedRoomId]);

  // Map existing blocks grouped by date
  const existingByDate = useMemo(() => {
    const map: Record<string, ShowtimeBlock[]> = {};
    if (!selectedRoomId || rawRoomShowtimes.length === 0) return map;

    const { close } = getOperatingRange(constraints.openTime, constraints.closeTime);

    for (const d of dateList) {
      const openISO = `${d}T${constraints.openTime}:00`;
      const closeDate = close > 1440
        ? dayjs(d).add(1, 'day').format('YYYY-MM-DD')
        : d;
      const closeISO = `${closeDate}T${constraints.closeTime}:00`;

      map[d] = rawRoomShowtimes
        .filter((st) => st.status !== 'CANCELLED' && st.startTime < closeISO && st.endTime > openISO)
        .map((st) => existingToBlock(st, openISO, movieMap));
    }
    return map;
  }, [selectedRoomId, rawRoomShowtimes, dateList, constraints.openTime, constraints.closeTime, movieMap]);

  const existingBlocks = existingByDate[selectedDate] || [];

  // ── Derived values ────────────────────────────────────────────────────────
  const { open: openMin, close: closeMin, totalMinutes: totalOperatingMinutes } =
    getOperatingRange(constraints.openTime, constraints.closeTime);
  const allBlocks: ShowtimeBlock[] = [...existingBlocks, ...blocks];
  const hasConflicts = blocks.some((b) => b.isConflict);
  const utilizationMinutes = blocks.reduce((acc, b) => acc + b.totalMinutes, 0);
  const utilizationPct = Math.round((utilizationMinutes / totalOperatingMinutes) * 100);

  // Multi-day metrics
  const totalScreeningsAllDays = useMemo(() => {
    return dateList.reduce((acc, d) => acc + (dailyBlocks[d]?.length || 0), 0);
  }, [dateList, dailyBlocks]);

  const daysWithBlocksCount = useMemo(() => {
    return dateList.filter((d) => (dailyBlocks[d]?.length || 0) > 0).length;
  }, [dateList, dailyBlocks]);

  const allDaysHaveConflicts = useMemo(() => {
    return dateList.some((d) => (dailyBlocks[d] || []).some((b) => b.isConflict));
  }, [dateList, dailyBlocks]);

  const activeBlock = activeDragId ? allBlocks.find((b) => b.id === activeDragId) : null;

  // Golden hours visual band coordinates
  let goldenStart = constraints.goldenHoursStart ? toMinutes(constraints.goldenHoursStart) : null;
  let goldenEnd = constraints.goldenHoursEnd ? toMinutes(constraints.goldenHoursEnd) : null;
  if (goldenStart !== null && goldenEnd !== null) {
    if (goldenEnd <= goldenStart) goldenEnd += 1440;
    if (goldenStart < openMin && closeMin > 1440 && goldenStart + 1440 < closeMin) {
      goldenStart += 1440;
      goldenEnd += 1440;
    }
  }

  const goldenLeftPct = goldenStart !== null && goldenStart >= openMin && goldenStart < closeMin
    ? ((goldenStart - openMin) / totalOperatingMinutes) * 100
    : null;
  const goldenRightPct = goldenEnd !== null && goldenEnd > openMin && goldenEnd <= closeMin
    ? ((goldenEnd - openMin) / totalOperatingMinutes) * 100
    : null;
  const goldenWidthPct = goldenLeftPct !== null && goldenRightPct !== null && goldenRightPct > goldenLeftPct
    ? goldenRightPct - goldenLeftPct
    : null;

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
    setLiveDragDeltaX(0);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    setLiveDragDeltaX(event.delta.x);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    setLiveDragDeltaX(0);

    const { active, delta } = event;
    if (!delta.x || !timelineRef.current) return;

    const blockId = active.id as string;
    const dragged = allBlocks.find((b) => b.id === blockId);
    if (!dragged || dragged.isLocked) return;

    const parentWidth = timelineRef.current.getBoundingClientRect().width;
    const deltaMinutes = (delta.x / parentWidth) * totalOperatingMinutes;
    // Snap to 5-minute grid
    const rawOffset = dragged.offsetMinutes + deltaMinutes;
    const snapped = Math.round(rawOffset / 5) * 5;
    const clamped = Math.max(0, Math.min(snapped, totalOperatingMinutes - dragged.totalMinutes));
    const newStart = toHHMM(openMin + clamped);

    moveBlock(blockId, newStart, constraints, existingBlocks, clamped);
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setLiveDragDeltaX(0);
  };

  // ── Movie Pool Handlers ───────────────────────────────────────────────────
  const toggleMovie = useCallback((movie: MovieResponse, colorClass: string) => {
    const refDate = dateMode === 'range' ? endDate : selectedDate;
    if (movie.releaseDate && dayjs(refDate).isBefore(dayjs(movie.releaseDate), 'day')) {
      addToast(
        t('autoShowtime.unreleasedMovieError', 'Cannot schedule "{{title}}" before its release date ({{date}}).', {
          title: movie.title,
          date: dayjs(movie.releaseDate).format('YYYY-MM-DD'),
        }),
        'error',
      );
      return;
    }

    setSelectedMovies((prev) => {
      const exists = prev.find((m) => m.id === movie.id);
      if (exists) return prev.filter((m) => m.id !== movie.id);
      const cached = moviePriorities[movie.id];
      const priority = cached?.priority ?? 1;
      const isHot = cached?.isHot ?? false;
      return [
        ...prev,
        {
          id: movie.id,
          title: movie.title,
          durationMinutes: movie.durationMinutes,
          priority,
          isHot,
          colorClass,
        },
      ];
    });
  }, [moviePriorities, selectedDate, endDate, dateMode, addToast, t]);

  const handlePriorityChange = useCallback((movieId: number, priority: number) => {
    setSelectedMovies((prev) => prev.map((m) => (m.id === movieId ? { ...m, priority } : m)));
    const current = selectedMovies.find((m) => m.id === movieId);
    setMoviePriority(movieId, priority, current?.isHot ?? false);
  }, [selectedMovies, setMoviePriority]);

  const handleHotToggle = useCallback((movieId: number, isHot: boolean) => {
    setSelectedMovies((prev) => prev.map((m) => (m.id === movieId ? { ...m, isHot } : m)));
    const current = selectedMovies.find((m) => m.id === movieId);
    setMoviePriority(movieId, current?.priority ?? 1, isHot);
  }, [selectedMovies, setMoviePriority]);

  // Single Day Auto-fill
  const handleAutoFillCurrentDay = () => {
    const releasedMovies = selectedMovies.filter((m) => {
      const full = availableMovies.find((am) => am.id === m.id);
      if (!full?.releaseDate) return true;
      return !dayjs(selectedDate).isBefore(dayjs(full.releaseDate), 'day');
    });

    if (releasedMovies.length === 0 && selectedMovies.length > 0) {
      addToast(t('autoShowtime.allUnreleasedError', 'All selected movies are upcoming and unreleased on this date.'), 'error');
      return;
    }

    const currentTheater = theaters.find((th) => th.rooms.some((r) => Number(r.id) === selectedRoomId));
    const roomIndex = currentTheater ? currentTheater.rooms.findIndex((r) => Number(r.id) === selectedRoomId) : 0;
    autoFill(releasedMovies, constraints, existingBlocks, Math.max(0, roomIndex), selectedDate);
  };

  // Batch Auto-fill All Days
  const handleAutoFillAllDays = () => {
    if (!selectedRoomId || selectedMovies.length === 0) return;

    const currentTheater = theaters.find((th) => th.rooms.some((r) => Number(r.id) === selectedRoomId));
    const roomIndex = currentTheater ? currentTheater.rooms.findIndex((r) => Number(r.id) === selectedRoomId) : 0;

    const dayConfigs = dateList.map((d) => {
      const releasedMovies = selectedMovies.filter((m) => {
        const full = availableMovies.find((am) => am.id === m.id);
        if (!full?.releaseDate) return true;
        return !dayjs(d).isBefore(dayjs(full.releaseDate), 'day');
      });
      return {
        date: d,
        movies: releasedMovies,
        locked: existingByDate[d] || [],
      };
    });

    autoFillDays(dayConfigs, constraints, Math.max(0, roomIndex));
    addToast(
      t('autoShowtime.autoFillAllSuccess', 'Generated schedule across {{count}} days!', { count: dateList.length }),
      'success',
    );
  };

  // Single Day Publish
  const handlePublish = async () => {
    if (!selectedRoomId || blocks.length === 0) return;

    // Upfront check for unreleased movies
    const unreleased = blocks.find((b) => {
      if (!b.movieId) return false;
      const full = availableMovies.find((m) => m.id === b.movieId);
      return full?.releaseDate && dayjs(selectedDate).isBefore(dayjs(full.releaseDate), 'day');
    });

    if (unreleased) {
      const full = availableMovies.find((m) => m.id === unreleased.movieId);
      addToast(
        t('autoShowtime.unreleasedPublishError', 'Cannot publish: "{{title}}" is not released until {{date}}.', {
          title: unreleased.title,
          date: full?.releaseDate,
        }),
        'error',
      );
      return;
    }

    const currentTheater = theaters.find((th) => th.rooms.some((r) => Number(r.id) === selectedRoomId));
    const currentRoom = currentTheater?.rooms.find((r) => Number(r.id) === selectedRoomId);
    const count = blocks.length;

    const ok = await publishSchedule(selectedRoomId, selectedDate, basePrice, constraints);
    if (ok) {
      addToast(t('autoShowtime.publishSuccessToast', 'Schedule published successfully!'), 'success');
      setSuccessInfo({
        count,
        roomName: currentRoom?.name || `Room ${selectedRoomId}`,
        theaterName: currentTheater?.name || '',
        date: selectedDate,
        rangeDays: 1,
      });
      setCountdown(4);
    } else {
      // Re-sync existing blocks on failure so timeline accurately matches DB
      showtimeService.getShowtimesByRoom(selectedRoomId)
        .then(setRawRoomShowtimes)
        .catch(console.error);
    }
  };

  // Multi-day Batch Publish
  const handlePublishMultiDay = async () => {
    if (!selectedRoomId || totalScreeningsAllDays === 0) return;

    // Upfront check for unreleased movies on each day
    for (const d of dateList) {
      const dayB = dailyBlocks[d] || [];
      const unreleased = dayB.find((b) => {
        if (!b.movieId) return false;
        const full = availableMovies.find((m) => m.id === b.movieId);
        return full?.releaseDate && dayjs(d).isBefore(dayjs(full.releaseDate), 'day');
      });
      if (unreleased) {
        const full = availableMovies.find((m) => m.id === unreleased.movieId);
        addToast(
          t('autoShowtime.unreleasedPublishError', 'Cannot publish: "{{title}}" is not released until {{date}}.', {
            title: unreleased.title,
            date: full?.releaseDate,
          }),
          'error',
        );
        return;
      }
    }

    const currentTheater = theaters.find((th) => th.rooms.some((r) => Number(r.id) === selectedRoomId));
    const currentRoom = currentTheater?.rooms.find((r) => Number(r.id) === selectedRoomId);

    const res = await publishMultiDay(selectedRoomId, dateList, basePrice, constraints);
    if (res.success) {
      addToast(
        t('autoShowtime.publishMultiSuccessToast', 'Published {{count}} showtimes across {{days}} days!', {
          count: res.totalPublished,
          days: dateList.length,
        }),
        'success',
      );
      setSuccessInfo({
        count: res.totalPublished,
        roomName: currentRoom?.name || `Room ${selectedRoomId}`,
        theaterName: currentTheater?.name || '',
        date: `${startDate} → ${endDate}`,
        rangeDays: dateList.length,
      });
      setCountdown(4);
    } else {
      // Re-sync existing blocks on partial failure
      showtimeService.getShowtimesByRoom(selectedRoomId)
        .then(setRawRoomShowtimes)
        .catch(console.error);
    }
  };

  // Auto-close success modal after 3-4s (4 seconds countdown)
  useEffect(() => {
    if (!successInfo) return;

    if (countdown <= 0) {
      onClose();
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [successInfo, countdown, onClose]);

  // ── Timeline tick marks ───────────────────────────────────────────────────
  const ticks: { pct: number; label: string }[] = [];
  for (let m = 0; m <= totalOperatingMinutes; m += 60) {
    ticks.push({ pct: (m / totalOperatingMinutes) * 100, label: toHHMM(openMin + m) });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-inverse-surface/70 backdrop-blur-sm overflow-y-auto py-6 px-4">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-7xl min-h-[90vh] flex flex-col">

        {/* Header */}
        <header className="px-8 py-5 border-b border-outline-variant flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <Wand2 size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-on-surface tracking-tight">{t('autoShowtime.title', 'Auto Showtime Creator')}</h2>
              <p className="text-xs text-on-surface-variant">{t('autoShowtime.subtitle', 'Golden Hours optimization · catalog distribution · multi-room staggering · drag & drop refinement')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors">
            <X size={20} />
          </button>
        </header>

        <div className="flex flex-1 min-h-0">

          {/* ── Sidebar ───────────────────────────────────────────────── */}
          <aside className="w-84 flex-shrink-0 border-r border-outline-variant flex flex-col overflow-y-auto">

            {/* Context */}
            <section className="p-6 border-b border-outline-variant/30">
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-on-surface-variant mb-4">{t('autoShowtime.context', 'Context')}</h3>
              {/* Mode Switcher */}
              <div className="flex bg-surface-container rounded-lg p-0.5 mb-3">
                <button
                  type="button"
                  onClick={() => setDateMode('single')}
                  className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md transition-all ${
                    dateMode === 'single'
                      ? 'bg-surface-container-lowest text-primary shadow-sm font-bold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {t('autoShowtime.singleDay', 'Single Day')}
                </button>
                <button
                  type="button"
                  onClick={() => setDateMode('range')}
                  className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    dateMode === 'range'
                      ? 'bg-surface-container-lowest text-primary shadow-sm font-bold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <Calendar size={12} />
                  {t('autoShowtime.dateRange', 'Date Range')}
                </button>
              </div>

              <div className="space-y-3">
                {dateMode === 'single' ? (
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">{t('autoShowtime.date', 'Date')}</label>
                    <input
                      type="date"
                      value={startDate}
                      min={today()}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setSelectedDate(e.target.value);
                      }}
                      className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">{t('autoShowtime.startDate', 'Start Date')}</label>
                      <input
                        type="date"
                        value={startDate}
                        min={today()}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          if (dayjs(endDate).isBefore(dayjs(e.target.value))) {
                            setEndDate(e.target.value);
                          }
                        }}
                        className="w-full border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">{t('autoShowtime.endDate', 'End Date')}</label>
                      <input
                        type="date"
                        value={endDate}
                        min={startDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    {/* Quick presets */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-on-surface-variant font-medium">Quick:</span>
                      <button
                        type="button"
                        onClick={() => setEndDate(dayjs(startDate).add(2, 'day').format('YYYY-MM-DD'))}
                        className="text-[10px] px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-semibold transition-colors"
                      >
                        +3 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setEndDate(dayjs(startDate).add(6, 'day').format('YYYY-MM-DD'))}
                        className="text-[10px] px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-semibold transition-colors"
                      >
                        +7 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setEndDate(dayjs(startDate).add(13, 'day').format('YYYY-MM-DD'))}
                        className="text-[10px] px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-semibold transition-colors"
                      >
                        +14 Days
                      </button>
                    </div>
                    <p className="text-[11px] text-primary font-medium">
                      {dateList.length} {t('autoShowtime.daysSelected', 'days selected')} ({dayjs(startDate).format('MMM D')} – {dayjs(endDate).format('MMM D')})
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">{t('autoShowtime.room', 'Room')}</label>
                  {isLoadingRooms ? (
                    <div className="flex items-center gap-2 text-on-surface-variant text-sm"><Loader2 size={14} className="animate-spin" /> {t('autoShowtime.loading', 'Loading...')}</div>
                  ) : (
                    <select value={selectedRoomId ?? ''}
                      onChange={(e) => setSelectedRoomId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                      <option value="">{t('autoShowtime.selectRoom', '— Select a room —')}</option>
                      {theaters.map((th) => th.rooms.map((r) => (
                        <option key={r.id} value={r.id}>{th.name} › {r.name}</option>
                      )))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">{t('autoShowtime.basePrice', 'Base Ticket Price (VND)')}</label>
                  <input type="number" value={basePrice} min={0} step={5000}
                    onChange={(e) => setBasePrice(Number(e.target.value))}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
            </section>

            {/* Operating window & Rules */}
            <section className="p-6 border-b border-outline-variant/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-on-surface-variant">{t('autoShowtime.operatingWindow', 'Rules & Operating Hours')}</h3>
              </div>

              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">{t('autoShowtime.open', 'Open')}</label>
                  <input type="time" value={constraints.openTime}
                    onChange={(e) => setConstraints((c) => ({ ...c, openTime: e.target.value }))}
                    className="w-full border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">{t('autoShowtime.close', 'Close')}</label>
                  <input type="time" value={constraints.closeTime}
                    onChange={(e) => setConstraints((c) => ({ ...c, closeTime: e.target.value }))}
                    className="w-full border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1">{t('autoShowtime.goldenStart', '⭐ Golden Start')}</label>
                  <input type="time" value={constraints.goldenHoursStart || '18:30'}
                    onChange={(e) => setConstraints((c) => ({ ...c, goldenHoursStart: e.target.value }))}
                    className="w-full border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1">{t('autoShowtime.goldenEnd', '⭐ Golden End')}</label>
                  <input type="time" value={constraints.goldenHoursEnd || '21:30'}
                    onChange={(e) => setConstraints((c) => ({ ...c, goldenHoursEnd: e.target.value }))}
                    className="w-full border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">{t('autoShowtime.adsMin', 'Ads (min)')}</label>
                  <input type="number" min={0} value={constraints.adsTimeMinutes}
                    onChange={(e) => setConstraints((c) => ({ ...c, adsTimeMinutes: Number(e.target.value) }))}
                    className="w-full border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">{t('autoShowtime.cleaningMin', 'Cleaning (min)')}</label>
                  <input type="number" min={0} value={constraints.cleaningTimeMinutes}
                    onChange={(e) => setConstraints((c) => ({ ...c, cleaningTimeMinutes: Number(e.target.value) }))}
                    className="w-full border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1" title="Max minutes Movie 1 may start before Golden Hour (e.g. 17:45 vs 18:30)">
                    {t('autoShowtime.preShift', 'Pre-shift (min)')}
                  </label>
                  <input type="number" min={0} max={120} value={constraints.maxPreShiftMinutes ?? 45}
                    onChange={(e) => setConstraints((c) => ({ ...c, maxPreShiftMinutes: Number(e.target.value) }))}
                    className="w-full border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1" title="Stagger offset per room index to spread lobby rush">
                    {t('autoShowtime.staggerOffset', 'Stagger (min)')}
                  </label>
                  <input type="number" min={0} max={60} value={constraints.staggerOffsetMinutes ?? 15}
                    onChange={(e) => setConstraints((c) => ({ ...c, staggerOffsetMinutes: Number(e.target.value) }))}
                    className="w-full border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-400" />
                </div>
              </div>

              {/* Local Storage Presets Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    saveConstraints(constraints);
                    setPresetSaved(true);
                    setTimeout(() => setPresetSaved(false), 2000);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold rounded-lg border border-outline-variant transition-colors"
                  title="Save current scheduling parameters to browser storage as default preset"
                >
                  {presetSaved ? (
                    <>
                      <Check size={12} className="text-emerald-500" />
                      <span className="text-emerald-600 font-bold">{t('autoShowtime.saved', 'Saved!')}</span>
                    </>
                  ) : (
                    <>
                      <Save size={12} />
                      <span>{t('autoShowtime.savePreset', 'Save Default Preset')}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const defaults = resetConstraints();
                    setConstraints(defaults);
                  }}
                  className="flex items-center justify-center p-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface rounded-lg border border-outline-variant transition-colors"
                  title="Reset to system default settings"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            </section>

            {/* Movie pool */}
            <section className="p-6 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-on-surface-variant">{t('autoShowtime.moviePool', 'Movie Pool')}</h3>
                {selectedMovies.length > 0 && (
                  <span className="text-xs bg-highlight text-primary font-bold px-2 py-0.5 rounded-full">{t('autoShowtime.selected', '{{count}} selected', { count: selectedMovies.length })}</span>
                )}
              </div>
              {isLoadingMovies ? (
                <div className="flex items-center gap-2 text-on-surface-variant text-sm"><Loader2 size={14} className="animate-spin" /> {t('autoShowtime.loadingMovies', 'Loading movies...')}</div>
              ) : availableMovies.length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant">
                  <Film size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{t('autoShowtime.noActiveMovies', 'No active movies found')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableMovies.map((movie, idx) => {
                    const colorClass = COLOUR_CLASSES[idx % COLOUR_CLASSES.length];
                    return (
                      <MovieSelectorRow
                        key={movie.id}
                        movie={movie}
                        selected={selectedMovies.find((m) => m.id === movie.id)}
                        colorClass={colorClass}
                        cachedPriority={moviePriorities[movie.id]}
                        selectedDate={selectedDate}
                        dateMode={dateMode}
                        endDate={endDate}
                        onToggle={toggleMovie}
                        onPriorityChange={handlePriorityChange}
                        onHotToggle={handleHotToggle}
                      />
                    );
                  })}
                </div>
              )}
            </section>

            {/* Actions */}
            <footer className="p-6 border-t border-outline-variant space-y-2.5">
              {dateMode === 'range' ? (
                <>
                  <button
                    onClick={handleAutoFillAllDays}
                    disabled={!selectedRoomId || selectedMovies.length === 0}
                    className="w-full flex items-center justify-center gap-2 bg-primary hover:opacity-90 text-white font-semibold rounded-xl py-3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm shadow-sm"
                  >
                    <Wand2 size={16} /> {t('autoShowtime.autoFillAll', 'Auto-Fill All {{count}} Days', { count: dateList.length })}
                  </button>
                  <button
                    onClick={handleAutoFillCurrentDay}
                    disabled={!selectedRoomId || selectedMovies.length === 0}
                    className="w-full flex items-center justify-center gap-2 border border-primary/30 text-primary hover:bg-primary/5 font-semibold rounded-xl py-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
                  >
                    <Play size={13} /> {t('autoShowtime.autoFillCurrent', 'Auto-Fill {{day}} Only', { day: dayjs(selectedDate).format('ddd') })}
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => clearBlocks(selectedDate)}
                      disabled={blocks.length === 0}
                      className="flex-1 flex items-center justify-center gap-1 border border-outline-variant hover:bg-surface-container-low text-on-surface-variant font-semibold rounded-xl py-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[11px]"
                    >
                      <ZapOff size={13} /> {t('autoShowtime.clearDay', 'Clear {{day}}', { day: dayjs(selectedDate).format('ddd') })}
                    </button>
                    <button
                      onClick={clearAllDays}
                      disabled={totalScreeningsAllDays === 0}
                      className="flex-1 flex items-center justify-center gap-1 border border-outline-variant hover:bg-surface-container-low text-on-surface-variant font-semibold rounded-xl py-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[11px]"
                    >
                      <RotateCcw size={13} /> {t('autoShowtime.clearAll', 'Clear All')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={handleAutoFillCurrentDay}
                    disabled={!selectedRoomId || selectedMovies.length === 0}
                    className="w-full flex items-center justify-center gap-2 bg-primary hover:opacity-90 text-white font-semibold rounded-xl py-3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Wand2 size={16} /> {t('autoShowtime.autoFill', 'Auto-Fill Schedule')}
                  </button>
                  <button
                    onClick={() => clearBlocks(selectedDate)}
                    disabled={blocks.length === 0}
                    className="w-full flex items-center justify-center gap-2 border border-outline-variant hover:bg-surface-container-low text-on-surface-variant font-semibold rounded-xl py-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    <ZapOff size={14} /> {t('autoShowtime.clearBlocks', 'Clear Generated Blocks')}
                  </button>
                </>
              )}
            </footer>
          </aside>

          {/* ── Main canvas ───────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 p-6 overflow-y-auto">

              {/* ── Day Navigation Tabs (when in date range mode) ── */}
              {dateMode === 'range' && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
                  {dateList.map((d) => {
                    const isSelected = d === selectedDate;
                    const dayObj = dayjs(d);
                    const dayName = dayObj.format('ddd'); // Mon, Tue...
                    const dateFormatted = dayObj.format('MMM D'); // Oct 11
                    const count = dailyBlocks[d]?.length || 0;
                    const hasConflict = (dailyBlocks[d] || []).some((b) => b.isConflict);

                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSelectedDate(d)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 border ${
                          isSelected
                            ? 'bg-primary text-white border-primary shadow-md shadow-primary/25 scale-[1.02]'
                            : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface border-outline-variant/40'
                        }`}
                      >
                        <span className="uppercase text-[10px] tracking-wider opacity-80">{dayName}</span>
                        <span className="font-mono">{dateFormatted}</span>
                        {hasConflict ? (
                          <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" title="Conflict on this date" />
                        ) : count > 0 ? (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                            }`}
                          >
                            {count}
                          </span>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-outline-variant/40" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-on-surface-variant flex items-center gap-2">
                  <Clock size={14} />
                  {t('autoShowtime.timeline', 'Timeline')} — {selectedDate} ({dayjs(selectedDate).format('dddd')})
                  {isLoadingExisting && <Loader2 size={12} className="animate-spin text-on-surface-variant" />}
                </h3>
                <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-400 inline-block" /> {t('autoShowtime.existing', 'Existing')}</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-primary inline-block" /> {t('autoShowtime.generated', 'Generated')}</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-error inline-block" /> {t('autoShowtime.conflict', 'Conflict')}</span>
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
                  className="relative rounded-xl border border-outline-variant bg-surface-container-low overflow-hidden"
                  style={{ height: '120px' }}
                >
                  {/* Golden Hours highlight */}
                  {goldenLeftPct !== null && goldenWidthPct !== null && (
                    <div
                      className="absolute top-0 bottom-0 bg-amber-400/10 border-x border-dashed border-amber-400/40 pointer-events-none z-0"
                      style={{ left: `${goldenLeftPct}%`, width: `${goldenWidthPct}%` }}
                    >
                      <span className="absolute top-1 left-2 text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        ⭐ {t('autoShowtime.goldenHours', 'Golden Hours')} ({constraints.goldenHoursStart}–{constraints.goldenHoursEnd})
                      </span>
                    </div>
                  )}

                  {/* Hour grid lines */}
                  {ticks.map((tick) => (
                    <div key={tick.label} className="absolute top-0 bottom-0 border-l border-outline-variant pointer-events-none"
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
                    <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant">
                      <div className="text-center">
                        <Play size={28} className="mx-auto mb-1 opacity-30" />
                        <p className="text-xs">{t('autoShowtime.emptyTimeline', 'Select movies and click Auto-Fill to generate a schedule')}</p>
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
                  <span key={tick.label} className="absolute text-[10px] text-on-surface-variant -translate-x-1/2"
                    style={{ left: `${tick.pct}%` }}>
                    {tick.label}
                  </span>
                ))}
              </div>

              {/* Generated blocks table */}
              {blocks.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">{t('autoShowtime.generatedScreenings', 'Generated Screenings')}</h3>
                  <div className="rounded-xl overflow-hidden border border-outline-variant">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-container-low">
                        <tr>
                          {[
                            t('autoShowtime.colMovie', 'Movie'),
                            t('autoShowtime.colStart', 'Start'),
                            t('autoShowtime.colEnd', 'End'),
                            t('autoShowtime.colDuration', 'Duration'),
                            t('autoShowtime.colStatus', 'Status'),
                            ''
                          ].map((h, i) => (
                            <th key={i} className="px-4 py-3 text-left text-[10px] uppercase font-bold text-on-surface-variant tracking-widest">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {blocks.map((block) => (
                          <tr key={block.id} className={block.isConflict ? 'bg-error-container' : 'bg-surface-container-lowest'}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${block.colorClass}`} />
                                <span className="font-medium text-on-surface">{block.title}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-on-surface-variant font-mono">{block.startTime}</td>
                            <td className="px-4 py-3 text-on-surface-variant font-mono">{block.endTime}</td>
                            <td className="px-4 py-3 text-on-surface-variant">{block.movieDurationMinutes} min</td>
                            <td className="px-4 py-3">
                              {block.isConflict ? (
                                <span className="flex items-center gap-1 text-red-600 text-xs font-bold"><AlertTriangle size={11} /> {t('autoShowtime.statusConflict', 'Conflict')}</span>
                              ) : (
                                <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold"><Check size={11} /> {t('autoShowtime.statusOk', 'OK')}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => removeBlock(block.id)}
                                className="p-1.5 rounded-lg hover:bg-error-container text-on-surface-variant hover:text-red-500 transition-colors">
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
            <div className="border-t border-outline-variant px-6 py-4 flex items-center justify-between gap-6 flex-shrink-0 bg-surface-container-low">
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{t('autoShowtime.screenings', 'Screenings')}</p>
                  {dateMode === 'range' ? (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-on-surface">{totalScreeningsAllDays}</span>
                      <span className="text-xs text-on-surface-variant font-semibold">({blocks.length} on {dayjs(selectedDate).format('ddd')})</span>
                    </div>
                  ) : (
                    <p className="text-2xl font-black text-on-surface">{blocks.length}</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
                    {dateMode === 'range' ? t('autoShowtime.daysFilled', 'Days Filled') : t('autoShowtime.utilization', 'Utilization')}
                  </p>
                  {dateMode === 'range' ? (
                    <p className="text-2xl font-black text-on-surface">{daysWithBlocksCount} <span className="text-xs font-normal text-on-surface-variant">/ {dateList.length}</span></p>
                  ) : (
                    <p className="text-2xl font-black text-on-surface">{utilizationPct}%</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{t('autoShowtime.validation', 'Validation')}</p>
                  {hasConflicts || allDaysHaveConflicts ? (
                    <p className="text-sm font-bold text-red-500 flex items-center gap-1">
                      <AlertTriangle size={13} /> {t('autoShowtime.conflictDetected', 'Conflict detected')}
                    </p>
                  ) : (dateMode === 'range' ? totalScreeningsAllDays > 0 : blocks.length > 0) ? (
                    <p className="text-sm font-bold text-emerald-600 flex items-center gap-1"><Check size={13} /> {t('autoShowtime.valid', 'Valid')}</p>
                  ) : (
                    <p className="text-sm text-on-surface-variant">—</p>
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
                    <Check size={14} /> {t('autoShowtime.publishedSuccess', 'Published successfully!')}
                  </span>
                )}
                {publishProgress && (
                  <span className="text-xs text-primary font-bold flex items-center gap-1.5 animate-pulse">
                    <Loader2 size={13} className="animate-spin" />
                    {t('autoShowtime.publishingDay', 'Day {{current}} of {{total}} ({{date}})', {
                      current: publishProgress.currentDay,
                      total: publishProgress.totalDays,
                      date: publishProgress.date,
                    })}
                  </span>
                )}
                {dateMode === 'range' ? (
                  <button
                    onClick={handlePublishMultiDay}
                    disabled={totalScreeningsAllDays === 0 || !selectedRoomId || allDaysHaveConflicts || isPublishing}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md text-sm"
                  >
                    {isPublishing ? (
                      <><Loader2 size={16} className="animate-spin" /> {t('autoShowtime.publishing', 'Publishing…')}</>
                    ) : (
                      <><Check size={16} /> {t('autoShowtime.publishAll', 'Publish All ({{count}} Screenings)', { count: totalScreeningsAllDays })}</>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handlePublish}
                    disabled={blocks.length === 0 || !selectedRoomId || hasConflicts || isPublishing}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md text-sm"
                  >
                    {isPublishing ? (
                      <><Loader2 size={16} className="animate-spin" /> {t('autoShowtime.publishing', 'Publishing…')}</>
                    ) : (
                      <><Check size={16} /> {t('autoShowtime.saveAndPublish', 'Save & Publish')}</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Set Success Popup Modal */}
      {successInfo && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full relative overflow-hidden flex flex-col items-center text-center">
            {/* Top Close Button (X) */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            {/* Success Icon */}
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
              <CheckCircle2 size={36} className="text-emerald-500" />
            </div>

            <h3 className="text-xl font-black text-on-surface tracking-tight mb-2">
              {t('autoShowtime.modalSuccessTitle', 'Schedule Set Successfully!')}
            </h3>
            <p className="text-xs text-on-surface-variant mb-5">
              {t('autoShowtime.modalSuccessSubtitle', 'Your showtimes have been saved to the database and are now active.')}
            </p>

            {/* Summary Details Card */}
            <div className="w-full bg-surface-container-low rounded-xl p-4 border border-outline-variant/20 mb-5 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface-variant">
                  {successInfo.rangeDays && successInfo.rangeDays > 1 ? t('autoShowtime.modalDateRange', 'Date Range') : t('autoShowtime.modalDate', 'Date')}:
                </span>
                <span className="font-bold text-on-surface">{successInfo.date}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface-variant">{t('autoShowtime.modalRoom', 'Room & Theater')}:</span>
                <span className="font-bold text-on-surface">
                  {successInfo.roomName} {successInfo.theaterName ? `· ${successInfo.theaterName}` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface-variant">{t('autoShowtime.modalScreenings', 'Total Screenings')}:</span>
                <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                  {successInfo.count} {t('autoShowtime.screenings', 'Screenings')}
                  {successInfo.rangeDays && successInfo.rangeDays > 1 ? ` (${successInfo.rangeDays} Days)` : ''}
                </span>
              </div>
            </div>

            {/* Auto-closing timer indicator */}
            <div className="w-full mb-5">
              <div className="flex items-center justify-between text-[11px] text-on-surface-variant mb-1.5 font-medium">
                <span>{t('autoShowtime.autoClosing', 'Automatically closing in')}</span>
                <span className="font-bold text-primary">{countdown}s</span>
              </div>
              <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${(countdown / 4) * 100}%` }}
                />
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={onClose}
              className="w-full bg-primary hover:bg-primary/90 text-on-primary font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 text-sm"
            >
              <Check size={16} />
              {t('autoShowtime.viewSchedule', 'Done · View in Schedule')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
