import { useCallback, useState } from 'react';
import {
  ScheduleConstraints,
  ScheduledMovie,
  ShowtimeBlock,
  CreateShowtimePayload,
} from '../types/schedule';
import { showtimeService } from '../services/showtimeService';
import {
  detectConflicts,
  runAutoFill,
  toHHMM,
  toISO,
  toMinutes,
} from '../utils/scheduleUtils';

// ── Public hook interface ─────────────────────────────────────────────────────

export interface UseAutoShowtimeReturn {
  blocks: ShowtimeBlock[];
  lockedBlocks: ShowtimeBlock[];
  isPublishing: boolean;
  publishError: string | null;
  publishSuccess: boolean;
  autoFill: (movies: ScheduledMovie[], constraints: ScheduleConstraints, locked: ShowtimeBlock[]) => void;
  clearBlocks: () => void;
  moveBlock: (blockId: string, newStartHHMM: string, constraints: ScheduleConstraints, locked: ShowtimeBlock[]) => void;
  removeBlock: (blockId: string) => void;
  publishSchedule: (
    roomId: number,
    date: string,
    basePrice: number,
    constraints: ScheduleConstraints,
  ) => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAutoShowtime(): UseAutoShowtimeReturn {
  const [blocks, setBlocks]               = useState<ShowtimeBlock[]>([]);
  const [lockedBlocks]                    = useState<ShowtimeBlock[]>([]);
  const [isPublishing, setIsPublishing]   = useState(false);
  const [publishError, setPublishError]   = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState(false);

  /** Run the greedy packing algorithm and update state. */
  const autoFill = useCallback(
    (movies: ScheduledMovie[], constraints: ScheduleConstraints, locked: ShowtimeBlock[]) => {
      const open         = toMinutes(constraints.openTime);
      const filled       = runAutoFill(movies, constraints, locked);
      const withConflicts = detectConflicts([...locked, ...filled], open);
      // Store only the generated (non-locked) blocks; locked are rendered separately.
      setBlocks(withConflicts.filter((b) => !b.isLocked));
      setPublishSuccess(false);
      setPublishError(null);
    },
    [],
  );

  /** Remove all generated blocks and reset publish status. */
  const clearBlocks = useCallback(() => {
    setBlocks([]);
    setPublishSuccess(false);
    setPublishError(null);
  }, []);

  /**
   * Drag a block to a new start time (snapping is done in the UI layer).
   * `locked` must include all existing showtimes/events for the selected room+date
   * so that conflict detection runs against the full timeline, not just generated blocks.
   */
  const moveBlock = useCallback(
    (blockId: string, newStartHHMM: string, constraints: ScheduleConstraints, locked: ShowtimeBlock[]) => {
      setBlocks((prev) => {
        const updated = prev.map((b) => {
          if (b.id !== blockId) return b;
          const newStart = toMinutes(newStartHHMM);
          const newEnd   = newStart + b.totalMinutes;
          return {
            ...b,
            startTime:     toHHMM(newStart),
            endTime:       toHHMM(newEnd),
            offsetMinutes: newStart - toMinutes(constraints.openTime),
          };
        });
        // Include locked blocks in conflict detection so dragging a generated block
        // correctly detects collisions with existing showtimes/events.
        const all = detectConflicts([...locked, ...updated], toMinutes(constraints.openTime));
        return all.filter((b) => !b.isLocked);
      });
    },
    [],
  );

  /** Delete a single generated block by id. */
  const removeBlock = useCallback((blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
  }, []);

  /**
   * POST each generated block to the backend as a real showtime.
   * Aborts early if any conflict is detected.
   */
  const publishSchedule = useCallback(
    async (
      roomId: number,
      date: string,
      basePrice: number,
      _constraints: ScheduleConstraints,
    ) => {
      setIsPublishing(true);
      setPublishError(null);
      setPublishSuccess(false);

      if (blocks.some((b) => b.isConflict)) {
        setPublishError('Resolve all conflicts before publishing.');
        setIsPublishing(false);
        return;
      }

      const payloads: CreateShowtimePayload[] = blocks.map((b) => ({
        roomId,
        movieId:   b.movieId,
        eventId:   b.eventId,
        startTime: toISO(date, b.startTime),
        endTime:   toISO(date, b.endTime),
        basePrice,
      }));

      try {
        await Promise.all(payloads.map((p) => showtimeService.createShowtime(p)));
        setPublishSuccess(true);
        setBlocks([]);
      } catch (err: any) {
        setPublishError(err?.response?.data?.message ?? 'Failed to publish. Try again.');
      } finally {
        setIsPublishing(false);
      }
    },
    [blocks],
  );

  return {
    blocks,
    lockedBlocks,
    isPublishing,
    publishError,
    publishSuccess,
    autoFill,
    clearBlocks,
    moveBlock,
    removeBlock,
    publishSchedule,
  };
}
