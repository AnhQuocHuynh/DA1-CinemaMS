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
  getOperatingRange,
  runAutoFill,
  toHHMM,
  toISO,
  toMinutes,
} from '../utils/scheduleUtils';

const todayISO = () => new Date().toISOString().slice(0, 10);

// ── Public hook interface ─────────────────────────────────────────────────────

export interface MultiDayProgress {
  currentDay: number;
  totalDays: number;
  date: string;
}

export interface MultiDayPublishResult {
  success: boolean;
  totalPublished: number;
  failedCount: number;
  error?: string;
}

export interface UseAutoShowtimeReturn {
  blocks: ShowtimeBlock[];
  dailyBlocks: Record<string, ShowtimeBlock[]>;
  lockedBlocks: ShowtimeBlock[];
  isPublishing: boolean;
  publishProgress: MultiDayProgress | null;
  publishError: string | null;
  publishSuccess: boolean;
  autoFill: (
    movies: ScheduledMovie[],
    constraints: ScheduleConstraints,
    locked: ShowtimeBlock[],
    roomIndex?: number,
    targetDate?: string,
  ) => void;
  autoFillDays: (
    dayConfigs: { date: string; movies: ScheduledMovie[]; locked: ShowtimeBlock[] }[],
    constraints: ScheduleConstraints,
    roomIndex?: number,
  ) => void;
  clearBlocks: (targetDate?: string) => void;
  clearAllDays: () => void;
  moveBlock: (
    blockId: string,
    newStartHHMM: string,
    constraints: ScheduleConstraints,
    locked: ShowtimeBlock[],
    newOffsetMinutes?: number,
    targetDate?: string,
  ) => void;
  removeBlock: (blockId: string, targetDate?: string) => void;
  publishSchedule: (
    roomId: number,
    date: string,
    basePrice: number,
    constraints: ScheduleConstraints,
  ) => Promise<boolean>;
  publishMultiDay: (
    roomId: number,
    dates: string[],
    basePrice: number,
    constraints: ScheduleConstraints,
    onProgress?: (progress: MultiDayProgress) => void,
  ) => Promise<MultiDayPublishResult>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAutoShowtime(currentDate?: string): UseAutoShowtimeReturn {
  const activeDate = currentDate || todayISO();
  const [dailyBlocks, setDailyBlocks]         = useState<Record<string, ShowtimeBlock[]>>({});
  const [lockedBlocks]                        = useState<ShowtimeBlock[]>([]);
  const [isPublishing, setIsPublishing]       = useState(false);
  const [publishProgress, setPublishProgress] = useState<MultiDayProgress | null>(null);
  const [publishError, setPublishError]       = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess]   = useState(false);

  // Active day's blocks
  const blocks = dailyBlocks[activeDate] || [];

  /** Run the greedy packing algorithm for a single day. */
  const autoFill = useCallback(
    (
      movies: ScheduledMovie[],
      constraints: ScheduleConstraints,
      locked: ShowtimeBlock[],
      roomIndex = 0,
      targetDate?: string,
    ) => {
      const dateKey = targetDate || activeDate;
      const { open }     = getOperatingRange(constraints.openTime, constraints.closeTime);
      const filled       = runAutoFill(movies, constraints, locked, roomIndex);
      const withConflicts = detectConflicts([...locked, ...filled], open);
      const nonLocked = withConflicts.filter((b) => !b.isLocked);

      setDailyBlocks((prev) => ({
        ...prev,
        [dateKey]: nonLocked,
      }));
      setPublishSuccess(false);
      setPublishError(null);
    },
    [activeDate],
  );

  /** Batch run the scheduling algorithm for multiple dates. */
  const autoFillDays = useCallback(
    (
      dayConfigs: { date: string; movies: ScheduledMovie[]; locked: ShowtimeBlock[] }[],
      constraints: ScheduleConstraints,
      roomIndex = 0,
    ) => {
      const { open } = getOperatingRange(constraints.openTime, constraints.closeTime);
      const updatedMap: Record<string, ShowtimeBlock[]> = {};

      for (const config of dayConfigs) {
        const filled = runAutoFill(config.movies, constraints, config.locked, roomIndex);
        const withConflicts = detectConflicts([...config.locked, ...filled], open);
        updatedMap[config.date] = withConflicts.filter((b) => !b.isLocked);
      }

      setDailyBlocks((prev) => ({
        ...prev,
        ...updatedMap,
      }));
      setPublishSuccess(false);
      setPublishError(null);
    },
    [],
  );

  /** Remove generated blocks for a target day (defaults to active day). */
  const clearBlocks = useCallback(
    (targetDate?: string) => {
      const dateKey = targetDate || activeDate;
      setDailyBlocks((prev) => ({ ...prev, [dateKey]: [] }));
      setPublishSuccess(false);
      setPublishError(null);
    },
    [activeDate],
  );

  /** Remove generated blocks across all days. */
  const clearAllDays = useCallback(() => {
    setDailyBlocks({});
    setPublishSuccess(false);
    setPublishError(null);
  }, []);

  /**
   * Drag a block to a new start time on a target day.
   */
  const moveBlock = useCallback(
    (
      blockId: string,
      newStartHHMM: string,
      constraints: ScheduleConstraints,
      locked: ShowtimeBlock[],
      newOffsetMinutes?: number,
      targetDate?: string,
    ) => {
      const dateKey = targetDate || activeDate;
      const { open } = getOperatingRange(constraints.openTime, constraints.closeTime);

      setDailyBlocks((prev) => {
        const currentList = prev[dateKey] || [];
        const updated = currentList.map((b) => {
          if (b.id !== blockId) return b;
          const newStart = toMinutes(newStartHHMM);
          const newEnd   = newStart + b.totalMinutes;
          const offsetMinutes = newOffsetMinutes !== undefined
            ? newOffsetMinutes
            : newStart - open;
          return {
            ...b,
            startTime:     toHHMM(newStart),
            endTime:       toHHMM(newEnd),
            offsetMinutes,
          };
        });
        const all = detectConflicts([...locked, ...updated], open);
        return {
          ...prev,
          [dateKey]: all.filter((b) => !b.isLocked),
        };
      });
    },
    [activeDate],
  );

  /** Delete a single generated block by id on a target day. */
  const removeBlock = useCallback(
    (blockId: string, targetDate?: string) => {
      const dateKey = targetDate || activeDate;
      setDailyBlocks((prev) => {
        const currentList = prev[dateKey] || [];
        return {
          ...prev,
          [dateKey]: currentList.filter((b) => b.id !== blockId),
        };
      });
    },
    [activeDate],
  );

  /**
   * POST generated blocks for a single date to the backend.
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

      const targetBlocks = dailyBlocks[date] || [];

      if (targetBlocks.some((b) => b.isConflict)) {
        setPublishError('Resolve all conflicts before publishing.');
        setIsPublishing(false);
        return false;
      }

      const { open } = getOperatingRange(_constraints.openTime, _constraints.closeTime);
      const payloads: CreateShowtimePayload[] = targetBlocks.map((b) => {
        const startLinearMin = open + b.offsetMinutes;
        const endLinearMin = startLinearMin + b.totalMinutes;
        const startDayOffset = Math.floor(startLinearMin / 1440);
        const endDayOffset = Math.floor(endLinearMin / 1440);

        return {
          roomId,
          movieId:   b.movieId,
          eventId:   b.eventId,
          startTime: toISO(date, b.startTime, startDayOffset),
          endTime:   toISO(date, b.endTime, endDayOffset),
          basePrice,
        };
      });

      try {
        let successCount = 0;
        const failedPayloads: { payload: CreateShowtimePayload; error: string }[] = [];

        for (const payload of payloads) {
          try {
            await showtimeService.createShowtime(payload);
            successCount++;
          } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to create showtime';
            failedPayloads.push({ payload, error: msg });
          }
        }

        if (failedPayloads.length === 0) {
          setPublishSuccess(true);
          setDailyBlocks((prev) => ({ ...prev, [date]: [] }));
          return true;
        }

        // If partial failure occurred, remove successfully published blocks from timeline
        if (successCount > 0) {
          setDailyBlocks((prev) => ({
            ...prev,
            [date]: (prev[date] || []).filter((b) =>
              failedPayloads.some(
                (fp) => fp.payload.movieId === b.movieId && fp.payload.startTime.includes(b.startTime),
              ),
            ),
          }));
        }

        const firstError = failedPayloads[0].error;
        const errorMsg = successCount > 0
          ? `${firstError} (${successCount} published, ${failedPayloads.length} failed). Timeline updated.`
          : firstError;

        setPublishError(errorMsg);
        return false;
      } finally {
        setIsPublishing(false);
      }
    },
    [dailyBlocks],
  );

  /**
   * Batch POST generated blocks across multiple dates.
   */
  const publishMultiDay = useCallback(
    async (
      roomId: number,
      dates: string[],
      basePrice: number,
      _constraints: ScheduleConstraints,
      onProgress?: (progress: MultiDayProgress) => void,
    ): Promise<MultiDayPublishResult> => {
      setIsPublishing(true);
      setPublishError(null);
      setPublishSuccess(false);

      const { open } = getOperatingRange(_constraints.openTime, _constraints.closeTime);
      let totalPublished = 0;
      let totalFailed = 0;
      const errors: string[] = [];

      try {
        const activeDatesWithBlocks = dates.filter((d) => (dailyBlocks[d] || []).length > 0);

        for (let i = 0; i < activeDatesWithBlocks.length; i++) {
          const date = activeDatesWithBlocks[i];
          const dayBlocks = dailyBlocks[date] || [];

          if (dayBlocks.some((b) => b.isConflict)) {
            errors.push(`Conflicts on ${date}. Skipped.`);
            totalFailed += dayBlocks.length;
            continue;
          }

          const progressInfo = { currentDay: i + 1, totalDays: activeDatesWithBlocks.length, date };
          setPublishProgress(progressInfo);
          if (onProgress) {
            onProgress(progressInfo);
          }

          const payloads: CreateShowtimePayload[] = dayBlocks.map((b) => {
            const startLinearMin = open + b.offsetMinutes;
            const endLinearMin = startLinearMin + b.totalMinutes;
            const startDayOffset = Math.floor(startLinearMin / 1440);
            const endDayOffset = Math.floor(endLinearMin / 1440);

            return {
              roomId,
              movieId:   b.movieId,
              eventId:   b.eventId,
              startTime: toISO(date, b.startTime, startDayOffset),
              endTime:   toISO(date, b.endTime, endDayOffset),
              basePrice,
            };
          });

          const dayFailedPayloads: { payload: CreateShowtimePayload; error: string }[] = [];

          for (const payload of payloads) {
            try {
              await showtimeService.createShowtime(payload);
              totalPublished++;
            } catch (err: any) {
              const msg = err?.response?.data?.message || err?.message || 'Failed to create showtime';
              dayFailedPayloads.push({ payload, error: msg });
              totalFailed++;
            }
          }

          if (dayFailedPayloads.length === 0) {
            setDailyBlocks((prev) => ({ ...prev, [date]: [] }));
          } else {
            setDailyBlocks((prev) => ({
              ...prev,
              [date]: (prev[date] || []).filter((b) =>
                dayFailedPayloads.some(
                  (fp) => fp.payload.movieId === b.movieId && fp.payload.startTime.includes(b.startTime),
                ),
              ),
            }));
            errors.push(`${date}: ${dayFailedPayloads[0].error}`);
          }
        }

        const allSuccess = totalFailed === 0 && errors.length === 0;
        if (allSuccess) {
          setPublishSuccess(true);
        } else {
          setPublishError(errors.join('; '));
        }

        return {
          success: allSuccess,
          totalPublished,
          failedCount: totalFailed,
          error: errors.length > 0 ? errors.join('; ') : undefined,
        };
      } finally {
        setIsPublishing(false);
        setPublishProgress(null);
      }
    },
    [dailyBlocks],
  );

  return {
    blocks,
    dailyBlocks,
    lockedBlocks,
    isPublishing,
    publishProgress,
    publishError,
    publishSuccess,
    autoFill,
    autoFillDays,
    clearBlocks,
    clearAllDays,
    moveBlock,
    removeBlock,
    publishSchedule,
    publishMultiDay,
  };
}
