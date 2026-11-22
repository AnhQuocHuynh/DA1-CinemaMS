/**
 * scheduleUtils.ts
 * Pure utility functions and algorithms for the Auto Showtime Creator.
 * Uses dayjs for all date/time arithmetic. No React dependencies.
 */

import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import duration from 'dayjs/plugin/duration';
import { ScheduleConstraints, ScheduledMovie, ShowtimeBlock } from '../types/schedule';

dayjs.extend(customParseFormat);
dayjs.extend(duration);

// ── Colour palette ────────────────────────────────────────────────────────────

/** Tailwind bg-* classes assigned round-robin to movies in the pool. */
export const COLOUR_CLASSES = [
  'bg-primary',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-fuchsia-500',
  'bg-lime-500',
] as const;

// ── Time conversion helpers ───────────────────────────────────────────────────

/** Parse an "HH:mm" string into total minutes since midnight. */
export function toMinutes(hhmm: string): number {
  const t = dayjs(hhmm, 'HH:mm');
  return t.hour() * 60 + t.minute();
}

/** Format total minutes since midnight back to "HH:mm" (wraps cleanly at 24h). */
export function toHHMM(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return dayjs().hour(h).minute(m).format('HH:mm');
}

/**
 * Compute the open and close minutes from midnight.
 * If closeTime <= openTime, closeTime crosses midnight into the next day (+1440 min).
 */
export function getOperatingRange(
  openHHMM: string,
  closeHHMM: string
): { open: number; close: number; totalMinutes: number } {
  const open = toMinutes(openHHMM);
  let close = toMinutes(closeHHMM);
  if (close <= open) {
    close += 1440;
  }
  return { open, close, totalMinutes: close - open };
}

/**
 * Combine a YYYY-MM-DD date string with an HH:mm time string and optional dayOffset
 * into a full ISO 8601 datetime string (seconds set to :00).
 */
export function toISO(date: string, hhmm: string, dayOffset = 0): string {
  const base = dayjs(`${date} ${hhmm}`, 'YYYY-MM-DD HH:mm');
  return base.add(dayOffset, 'day').format('YYYY-MM-DDTHH:mm:ss');
}

/**
 * Add `minutes` to an "HH:mm" string and return a new "HH:mm".
 */
export function addMinutes(hhmm: string, minutes: number): string {
  return toHHMM(toMinutes(hhmm) + minutes);
}

// ── Free Slot Helper ──────────────────────────────────────────────────────────

export interface TimeSlot {
  start: number; // minutes from midnight
  end: number;   // minutes from midnight
}

/**
 * Compute available unreserved intervals between open and close,
 * subtracting all locked blocks (events, existing showtimes).
 * Handles overnight / 24h ranges where close > 1440 min.
 */
export function computeFreeSlots(
  open: number,
  close: number,
  lockedBlocks: ShowtimeBlock[]
): TimeSlot[] {
  const sortedLocked = [...lockedBlocks]
    .map((b) => {
      let start: number;
      let end: number;
      if (typeof b.offsetMinutes === 'number' && b.offsetMinutes >= 0) {
        start = open + b.offsetMinutes;
        end = start + b.totalMinutes;
      } else {
        start = toMinutes(b.startTime);
        end = toMinutes(b.endTime);
        if (close > 1440 && start < open && start + 1440 < close) {
          start += 1440;
          end += 1440;
        } else if (end <= start) {
          end += 1440;
        }
      }
      return { start, end };
    })
    .sort((a, b) => a.start - b.start);

  const slots: TimeSlot[] = [];
  let cursor = open;

  for (const locked of sortedLocked) {
    if (locked.end <= cursor) continue;
    if (locked.start >= close) break;

    if (locked.start > cursor) {
      slots.push({
        start: cursor,
        end: Math.min(locked.start, close),
      });
    }
    cursor = Math.max(cursor, locked.end);
  }

  if (cursor < close) {
    slots.push({ start: cursor, end: close });
  }

  return slots;
}

/**
 * Split or remove free slots when a new block is placed.
 */
export function subtractIntervalFromSlots(
  slots: TimeSlot[],
  occupiedStart: number,
  occupiedEnd: number
): TimeSlot[] {
  const result: TimeSlot[] = [];

  for (const slot of slots) {
    if (occupiedEnd <= slot.start || occupiedStart >= slot.end) {
      // No overlap
      result.push(slot);
    } else {
      // Overlaps
      if (occupiedStart > slot.start) {
        result.push({ start: slot.start, end: occupiedStart });
      }
      if (occupiedEnd < slot.end) {
        result.push({ start: occupiedEnd, end: slot.end });
      }
    }
  }

  return result.sort((a, b) => a.start - b.start);
}

// ── 5-Phase Auto-Fill Scheduling Algorithm ────────────────────────────────────

/**
 * 5-Phase Heuristic Scheduling Algorithm:
 * 1. Free Slot Discovery (Locked block protection).
 * 2. Golden Hour Dual-Screening Optimization (Backward-Shift Heuristic).
 * 3. Weighted Round-Robin Catalog Distribution.
 * 4. Knapsack Best-Fit Gap-Filling.
 * 5. Multi-Room Stagger Offset & Conflict Verification.
 *
 * @param selectedMovies  Movies in the pool with priority and duration.
 * @param constraints     Operating window, buffers, golden hours, pre-shift limit.
 * @param lockedBlocks    Immovable existing blocks.
 * @param roomIndex       Optional index of the room in theater for stagger calculation.
 */
export function runAutoFill(
  selectedMovies: ScheduledMovie[],
  constraints: ScheduleConstraints,
  lockedBlocks: ShowtimeBlock[],
  roomIndex = 0
): ShowtimeBlock[] {
  if (!selectedMovies.length) return [];

  const buffer = constraints.cleaningTimeMinutes + constraints.adsTimeMinutes;
  const { open, close } = getOperatingRange(constraints.openTime, constraints.closeTime);

  let goldenStart = toMinutes(constraints.goldenHoursStart || '18:30');
  let goldenEnd = toMinutes(constraints.goldenHoursEnd || '21:30');
  if (goldenEnd <= goldenStart) {
    goldenEnd += 1440;
  }
  if (goldenStart < open && close > 1440 && goldenStart + 1440 < close) {
    goldenStart += 1440;
    goldenEnd += 1440;
  }

  const maxPreShift = constraints.maxPreShiftMinutes ?? 45;
  const staggerOffset = roomIndex * (constraints.staggerOffsetMinutes ?? 0);

  // Staggered open time for this specific room
  const effectiveOpen = Math.min(open + staggerOffset, close);

  // Minimum duration required for any movie block
  const minMovieDuration = Math.min(...selectedMovies.map((m) => m.durationMinutes));
  const minBlockTime = minMovieDuration + buffer;

  // ── Phase 1: Free Slot Discovery ───────────────────────────────────────────
  let freeSlots = computeFreeSlots(effectiveOpen, close, lockedBlocks)
    .filter((slot) => slot.end - slot.start >= minBlockTime);

  const generatedBlocks: Array<Omit<ShowtimeBlock, 'id' | 'isConflict'>> = [];

  // Helper to record a block and carve out its occupied time from free slots
  const recordBlock = (movie: ScheduledMovie, startMin: number) => {
    const totalBlock = movie.durationMinutes + buffer;
    const endMin = startMin + totalBlock;

    generatedBlocks.push({
      movieId: movie.id,
      title: movie.title,
      startTime: toHHMM(startMin),
      endTime: toHHMM(endMin),
      totalMinutes: totalBlock,
      movieDurationMinutes: movie.durationMinutes,
      colorClass: movie.colorClass,
      isLocked: false,
      offsetMinutes: startMin - open,
    });

    freeSlots = subtractIntervalFromSlots(freeSlots, startMin, endMin)
      .filter((slot) => slot.end - slot.start >= minBlockTime);
  };

  const appendBlock = (movie: ScheduledMovie, startMin: number) => {
    const totalBlock = movie.durationMinutes + buffer;
    const endMin = startMin + totalBlock;

    generatedBlocks.push({
      movieId: movie.id,
      title: movie.title,
      startTime: toHHMM(startMin),
      endTime: toHHMM(endMin),
      totalMinutes: totalBlock,
      movieDurationMinutes: movie.durationMinutes,
      colorClass: movie.colorClass,
      isLocked: false,
      offsetMinutes: startMin - open,
    });
  };

  // ── Phase 2: Golden Hour Dual-Screening (Backward-Shift Heuristic) ───────────
  // Find prime movies (Priority 3 or isHot), followed by next-best movies in catalog
  const primeMovies = selectedMovies.filter((m) => m.priority === 3 || m.isHot);
  const otherMovies = selectedMovies
    .filter((m) => !primeMovies.includes(m))
    .sort((a, b) => b.priority - a.priority);
  const topMovies = [...primeMovies, ...otherMovies];

  if (topMovies.length > 0) {
    const m1 = topMovies[0];
    const m2 = topMovies[1] || topMovies[0]; // Next best movie or repeat single movie

    const b1 = m1.durationMinutes + buffer;
    const b2 = m2.durationMinutes + buffer;

    // Find a free slot that intersects the prime evening timeframe
    const earliestPreShiftStart = Math.max(effectiveOpen, goldenStart - maxPreShift);
    const goldenSlot = freeSlots.find(
      (slot) => slot.start < goldenEnd && slot.end > earliestPreShiftStart && slot.end - slot.start >= b1
    );

    if (goldenSlot) {
      let placedDual = false;

      // Strategy 2A: Backward-Shift Lookback
      // Anchor Movie 2 around prime post-dinner sweet spot (e.g. 19:45 - 20:15)
      const earliestAllowed = Math.max(goldenSlot.start, earliestPreShiftStart);
      const idealM2Start = Math.max(
        goldenStart,
        Math.min(goldenStart + 90, goldenEnd - b2 + 30)
      );
      // Determine Movie 1 start: shifted back from ideal M2, bounded by earliestAllowed
      const shiftedM1Start = Math.max(earliestAllowed, idealM2Start - b1);
      const actualM2Start = shiftedM1Start + b1;

      if (
        shiftedM1Start >= earliestAllowed &&
        actualM2Start >= goldenStart &&
        actualM2Start <= goldenEnd &&
        actualM2Start + b2 <= goldenSlot.end
      ) {
        // Dual placement succeeded via Backward-Shift!
        recordBlock(m1, shiftedM1Start);
        recordBlock(m2, actualM2Start);
        placedDual = true;
      }

      // Strategy 2B: Sequential fit inside slot without pre-shift
      if (!placedDual) {
        const seqStart = Math.max(goldenSlot.start, goldenStart);
        if (seqStart + b1 + b2 <= goldenSlot.end) {
          recordBlock(m1, seqStart);
          recordBlock(m2, seqStart + b1);
          placedDual = true;
        }
      }

      // Strategy 2C: Single prime screening fallback
      if (!placedDual) {
        const singleStart = Math.max(goldenSlot.start, goldenStart);
        if (singleStart + b1 <= goldenSlot.end) {
          recordBlock(m1, singleStart);
        } else if (goldenSlot.start + b1 <= goldenSlot.end) {
          recordBlock(m1, goldenSlot.start);
        }
      }
    }
  }

  // ── Phase 3: Weighted Round-Robin Catalog Distribution ───────────────────────
  // Build a priority-weighted cyclic queue (P3 = 3x, P2 = 2x, P1 = 1x)
  const weightedQueue: ScheduledMovie[] = [];
  for (const movie of selectedMovies) {
    const weight = Math.max(1, Math.min(3, movie.priority));
    for (let w = 0; w < weight; w++) {
      weightedQueue.push(movie);
    }
  }

  let queueIdx = 0;

  for (const slot of freeSlots) {
    let cursor = slot.start;

    // Fill the slot with round-robin movies
    let attempts = 0;
    while (cursor + minBlockTime <= slot.end && attempts < weightedQueue.length) {
      const candidate = weightedQueue[queueIdx % weightedQueue.length];
      const candidateBlock = candidate.durationMinutes + buffer;

      if (cursor + candidateBlock <= slot.end) {
        appendBlock(candidate, cursor);
        cursor += candidateBlock;
        queueIdx++;
        attempts = 0;
      } else {
        queueIdx++;
        attempts++;
      }
    }

    // ── Phase 4: Knapsack Best-Fit Gap-Filling ─────────────────────────────────
    // If leftover time remains in this slot (>= minBlockTime), find best-fit shorter movie
    const remainingTime = slot.end - cursor;
    if (remainingTime >= minBlockTime) {
      const fittingMovies = selectedMovies
        .map((m) => ({ movie: m, total: m.durationMinutes + buffer }))
        .filter((item) => item.total <= remainingTime)
        .sort((a, b) => b.total - a.total); // Largest that still fits (Knapsack Best-Fit)

      if (fittingMovies.length > 0) {
        const bestFit = fittingMovies[0].movie;
        appendBlock(bestFit, cursor);
      }
    }
  }

  // ── Phase 5: Sorting & Conflict Detection ───────────────────────────────────
  const sortedBlocks = generatedBlocks
    .sort((a, b) => a.offsetMinutes - b.offsetMinutes)
    .map((block, idx) => ({
      ...block,
      id: `block-${idx}`,
      isConflict: false,
    }));

  return detectConflicts(sortedBlocks, open);
}

// ── Conflict detection ────────────────────────────────────────────────────────

/**
 * Recalculate the `isConflict` flag and `offsetMinutes` for every block.
 * Two blocks conflict when their time intervals overlap.
 * Uses linear timeline offsetMinutes when present to support overnight windows.
 *
 * @param blocks  All blocks on the timeline (locked + generated).
 * @param open    Opening time in minutes since midnight, used to compute offsets.
 */
export function detectConflicts(blocks: ShowtimeBlock[], open: number): ShowtimeBlock[] {
  return blocks.map((block) => {
    const bStart = typeof block.offsetMinutes === 'number'
      ? open + block.offsetMinutes
      : toMinutes(block.startTime);
    const bEnd = typeof block.offsetMinutes === 'number'
      ? bStart + block.totalMinutes
      : toMinutes(block.endTime) <= bStart ? toMinutes(block.endTime) + 1440 : toMinutes(block.endTime);

    const conflict = blocks.some((other) => {
      if (other.id === block.id) return false;
      const oStart = typeof other.offsetMinutes === 'number'
        ? open + other.offsetMinutes
        : toMinutes(other.startTime);
      const oEnd = typeof other.offsetMinutes === 'number'
        ? oStart + other.totalMinutes
        : toMinutes(other.endTime) <= oStart ? toMinutes(other.endTime) + 1440 : toMinutes(other.endTime);

      return bStart < oEnd && bEnd > oStart;
    });
    return {
      ...block,
      isConflict: conflict,
      offsetMinutes: typeof block.offsetMinutes === 'number' ? block.offsetMinutes : bStart - open,
    };
  });
}
