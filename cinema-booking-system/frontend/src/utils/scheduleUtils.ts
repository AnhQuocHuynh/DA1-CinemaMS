/**
 * scheduleUtils.ts
 * Pure utility functions and constants for the Auto Showtime Creator.
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
  'bg-blue-500',
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

/** Format total minutes since midnight back to "HH:mm" (wraps at 24 h). */
export function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return dayjs().hour(h).minute(m).format('HH:mm');
}

/**
 * Combine a YYYY-MM-DD date string with an HH:mm time string
 * into a full ISO 8601 datetime string (seconds set to :00).
 */
export function toISO(date: string, hhmm: string): string {
  return dayjs(`${date} ${hhmm}`, 'YYYY-MM-DD HH:mm').format('YYYY-MM-DDTHH:mm:ss');
}

/**
 * Add `minutes` to an "HH:mm" string and return a new "HH:mm".
 * Convenience wrapper used in the algorithm.
 */
export function addMinutes(hhmm: string, minutes: number): string {
  return toHHMM(toMinutes(hhmm) + minutes);
}

// ── Greedy auto-fill algorithm ────────────────────────────────────────────────

/**
 * Pack as many movie screenings as possible into the operating window using a
 * greedy round-robin strategy weighted by movie priority.
 *
 * @param selectedMovies  Movies in the pool with their priority weights.
 * @param constraints     Operating window and buffer time settings.
 * @param lockedBlocks    Immovable existing blocks (events / existing showtimes)
 *                        that the algorithm must route around.
 * @returns               Array of newly generated ShowtimeBlocks (not locked).
 */
export function runAutoFill(
  selectedMovies: ScheduledMovie[],
  constraints: ScheduleConstraints,
  lockedBlocks: ShowtimeBlock[],
): ShowtimeBlock[] {
  if (!selectedMovies.length) return [];

  const buffer = constraints.cleaningTimeMinutes + constraints.adsTimeMinutes;
  const open   = toMinutes(constraints.openTime);
  const close  = toMinutes(constraints.closeTime);

  // Build a priority-expanded, cyclically-ordered movie queue.
  // Higher-priority movies appear more often in the rotation.
  const queue: ScheduledMovie[] = [];
  const maxPriority = Math.max(...selectedMovies.map((m) => m.priority));
  for (let p = maxPriority; p >= 1; p--) {
    selectedMovies.filter((m) => m.priority >= p).forEach((m) => queue.push(m));
  }

  // Sort locked blocks once by start time for efficient scanning.
  const sortedLocked = [...lockedBlocks].sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime),
  );

  const blocks: ShowtimeBlock[] = [];
  let cursor     = open;
  let blockIndex = 0;
  let queueIndex = 0;

  // Guard against infinite loops in degenerate configurations.
  const MAX_ITERATIONS = 500;
  let iter = 0;

  outer: while (iter++ < MAX_ITERATIONS) {
    // Advance cursor past any locked block that covers the current position.
    for (const locked of sortedLocked) {
      const ls = toMinutes(locked.startTime);
      const le = toMinutes(locked.endTime);
      if (cursor >= ls && cursor < le) {
        cursor = le;
      }
    }

    if (cursor >= close) break;

    // Try each movie in the queue (round-robin), starting at queueIndex.
    let tried = 0;
    while (tried < queue.length) {
      const movie      = queue[(queueIndex + tried) % queue.length];
      const totalBlock = buffer + movie.durationMinutes;

      // Does the block fit inside the operating window?
      if (cursor + totalBlock > close) {
        tried++;
        continue;
      }

      // Does the block overlap any locked block?
      const blockEnd   = cursor + totalBlock;
      const hitsLocked = sortedLocked.some((locked) => {
        const ls = toMinutes(locked.startTime);
        const le = toMinutes(locked.endTime);
        return cursor < le && blockEnd > ls;
      });

      if (hitsLocked) {
        // Jump cursor to the end of the colliding locked block and retry.
        for (const locked of sortedLocked) {
          const ls = toMinutes(locked.startTime);
          const le = toMinutes(locked.endTime);
          if (cursor < le && blockEnd > ls) {
            cursor = le;
            continue outer;
          }
        }
      }

      // All checks passed — emit the block.
      blocks.push({
        id:                   `block-${blockIndex++}`,
        movieId:              movie.id,
        title:                movie.title,
        startTime:            toHHMM(cursor),
        endTime:              toHHMM(cursor + totalBlock),
        totalMinutes:         totalBlock,
        movieDurationMinutes: movie.durationMinutes,
        colorClass:           movie.colorClass,
        isLocked:             false,
        isConflict:           false,
        offsetMinutes:        cursor - open,
      });

      cursor     += totalBlock;
      queueIndex  = (queueIndex + tried + 1) % queue.length;
      break;
    }

    // No movie could be placed — the remaining time is too short.
    if (tried === queue.length) break;
  }

  return blocks;
}

// ── Conflict detection ────────────────────────────────────────────────────────

/**
 * Recalculate the `isConflict` flag and `offsetMinutes` for every block.
 * Two blocks conflict when their time intervals overlap.
 *
 * @param blocks  All blocks on the timeline (locked + generated).
 * @param open    Opening time in minutes since midnight, used to compute offsets.
 */
export function detectConflicts(blocks: ShowtimeBlock[], open: number): ShowtimeBlock[] {
  return blocks.map((block) => {
    const bStart   = toMinutes(block.startTime);
    const bEnd     = toMinutes(block.endTime);
    const conflict = blocks.some((other) => {
      if (other.id === block.id) return false;
      const oStart = toMinutes(other.startTime);
      const oEnd   = toMinutes(other.endTime);
      return bStart < oEnd && bEnd > oStart;
    });
    return { ...block, isConflict: conflict, offsetMinutes: bStart - open };
  });
}
