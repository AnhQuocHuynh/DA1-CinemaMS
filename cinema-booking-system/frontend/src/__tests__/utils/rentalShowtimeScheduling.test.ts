import { describe, it, expect } from 'vitest';
import { rentalBusySlotToBlock } from '../../utils/rentalUtils';
import {
  detectConflicts,
  runAutoFill,
  toMinutes,
} from '../../utils/scheduleUtils';
import { BusySlot } from '../../types/rental';
import { ScheduleConstraints, ScheduledMovie, ShowtimeBlock } from '../../types/schedule';

describe('Rental Showtime Scheduling Conflict Guard', () => {
  const defaultConstraints: ScheduleConstraints = {
    openTime: '08:00',
    closeTime: '23:00',
    cleaningTimeMinutes: 10,
    adsTimeMinutes: 5, // total buffer = 15m
    goldenHoursStart: '18:30',
    goldenHoursEnd: '21:30',
    maxPreShiftMinutes: 45,
    staggerOffsetMinutes: 0,
  };

  const sampleMovies: ScheduledMovie[] = [
    {
      id: 1,
      title: 'Action Blast',
      durationMinutes: 105, // total block = 105 + 15 = 120m
      priority: 2,
      colorClass: 'bg-primary',
    },
    {
      id: 2,
      title: 'Comedy Rush',
      durationMinutes: 75, // total block = 75 + 15 = 90m
      priority: 1,
      colorClass: 'bg-emerald-500',
    },
  ];

  // ── 1. Normal Path ──────────────────────────────────────────────────────────
  describe('Normal Path', () => {
    it('schedules movies before 13:45 and after 16:15 with zero overlaps and zero conflicts', () => {
      // Rental BusySlot representing 14:00-16:00 rental + 15m buffer (13:45-16:15)
      const slot: BusySlot = {
        source: 'RENTAL',
        startTime: '2026-11-10T13:45:00',
        endTime: '2026-11-10T16:15:00',
        status: 'CONFIRMED',
      };
      const openISO = '2026-11-10T08:00:00';
      const closeISO = '2026-11-10T23:00:00';

      const rentalBlock = rentalBusySlotToBlock(slot, openISO, 0, closeISO);

      expect(rentalBlock.startTime).toBe('13:45');
      expect(rentalBlock.endTime).toBe('16:15');
      expect(rentalBlock.totalMinutes).toBe(150);
      expect(rentalBlock.offsetMinutes).toBe(345); // (13:45 - 08:00) = 5h45m = 345m
      expect(rentalBlock.isLocked).toBe(true);
      expect(rentalBlock.colorClass).toBe('bg-amber-600');

      const schedule = runAutoFill(sampleMovies, defaultConstraints, [rentalBlock]);

      expect(schedule.length).toBeGreaterThan(0);

      const rentalStartMin = toMinutes('13:45'); // 825
      const rentalEndMin = toMinutes('16:15');   // 975

      // Zero blocks overlap the [13:45, 16:15] window
      for (const block of schedule) {
        const bStart = toMinutes(block.startTime);
        const bEnd = toMinutes(block.endTime);
        const overlaps = bStart < rentalEndMin && bEnd > rentalStartMin;
        expect(overlaps).toBe(false);

        // Every block finishes on/before 13:45 OR starts on/after 16:15
        expect(bEnd <= rentalStartMin || bStart >= rentalEndMin).toBe(true);
      }

      // Check conflict detection on combined timeline
      const combined = detectConflicts([...schedule, rentalBlock], toMinutes('08:00'));
      expect(combined.every((b) => !b.isConflict)).toBe(true);
    });
  });

  // ── 2. Golden Hour Path ─────────────────────────────────────────────────────
  describe('Golden Hour Path', () => {
    it('skips Golden Hours without overlapping rental (18:15-21:45) and fills other free slots cleanly', () => {
      const slot: BusySlot = {
        source: 'RENTAL',
        startTime: '2026-11-10T18:15:00',
        endTime: '2026-11-10T21:45:00',
        status: 'CONFIRMED',
      };
      const openISO = '2026-11-10T08:00:00';
      const closeISO = '2026-11-10T23:30:00';

      const rentalBlock = rentalBusySlotToBlock(slot, openISO, 0, closeISO);

      const goldenConstraints: ScheduleConstraints = {
        ...defaultConstraints,
        closeTime: '23:30',
        goldenHoursStart: '18:30',
        goldenHoursEnd: '21:30',
      };

      const highPriorityMovies: ScheduledMovie[] = [
        {
          id: 10,
          title: 'Prime Blockbuster',
          durationMinutes: 105,
          priority: 3,
          isHot: true,
          colorClass: 'bg-primary',
        },
        {
          id: 20,
          title: 'Daytime Hit',
          durationMinutes: 75,
          priority: 2,
          colorClass: 'bg-emerald-500',
        },
      ];

      const schedule = runAutoFill(highPriorityMovies, goldenConstraints, [rentalBlock]);

      expect(schedule.length).toBeGreaterThan(0);

      const rentalStartMin = toMinutes('18:15'); // 1095
      const rentalEndMin = toMinutes('21:45');   // 1305

      // Verify no generated block overlaps Golden Hour rental
      for (const block of schedule) {
        const bStart = toMinutes(block.startTime);
        const bEnd = toMinutes(block.endTime);
        const overlaps = bStart < rentalEndMin && bEnd > rentalStartMin;
        expect(overlaps).toBe(false);
      }

      // Verify morning/afternoon slots are populated cleanly
      const morningBlocks = schedule.filter((b) => toMinutes(b.endTime) <= rentalStartMin);
      expect(morningBlocks.length).toBeGreaterThanOrEqual(1);

      // Verify all blocks report zero conflicts
      const combined = detectConflicts([...schedule, rentalBlock], toMinutes('08:00'));
      expect(combined.every((b) => !b.isConflict)).toBe(true);
    });
  });

  // ── 3. Boundary / Abnormal Path ─────────────────────────────────────────────
  describe('Boundary / Abnormal Path', () => {
    it('clamps offsetMinutes to 0 when rental buffer starts before open time (07:45 vs 08:00 open)', () => {
      // Rental starting at 08:00 with 15m cleaning buffer starts at 07:45
      const slot: BusySlot = {
        source: 'RENTAL',
        startTime: '2026-11-10T07:45:00',
        endTime: '2026-11-10T10:15:00',
        status: 'CONFIRMED',
      };
      const openISO = '2026-11-10T08:00:00';
      const closeISO = '2026-11-10T23:00:00';

      const rentalBlock = rentalBusySlotToBlock(slot, openISO, 0, closeISO);

      expect(rentalBlock.startTime).toBe('08:00');
      expect(rentalBlock.endTime).toBe('10:15');
      expect(rentalBlock.offsetMinutes).toBe(0); // Clamped, not negative
      expect(rentalBlock.totalMinutes).toBe(135); // 08:00 to 10:15 = 135m

      const schedule = runAutoFill(sampleMovies, defaultConstraints, [rentalBlock]);

      expect(schedule.length).toBeGreaterThan(0);

      // First movie must start at or after 10:15
      const firstMovieStart = toMinutes(schedule[0].startTime);
      expect(firstMovieStart).toBeGreaterThanOrEqual(toMinutes('10:15'));

      // Zero blocks overlap [08:00, 10:15]
      for (const block of schedule) {
        const bStart = toMinutes(block.startTime);
        expect(bStart).toBeGreaterThanOrEqual(toMinutes('10:15'));
      }

      const combined = detectConflicts([...schedule, rentalBlock], toMinutes('08:00'));
      expect(combined.every((b) => !b.isConflict)).toBe(true);
    });

    it('skips narrow gaps between rentals smaller than minBlockTime and fills valid slots', () => {
      const openISO = '2026-11-10T08:00:00';
      const closeISO = '2026-11-10T23:00:00';

      // Rental 1: 12:00 to 14:00
      const r1 = rentalBusySlotToBlock(
        {
          source: 'RENTAL',
          startTime: '2026-11-10T12:00:00',
          endTime: '2026-11-10T14:00:00',
          status: 'CONFIRMED',
        },
        openISO,
        0,
        closeISO
      );

      // Rental 2: 14:45 to 17:00
      // Gap between R1 and R2 is 14:00 to 14:45 = 45m.
      // Smallest movie is 75m + 15m buffer = 90m minBlockTime. 45m cannot fit any movie.
      const r2 = rentalBusySlotToBlock(
        {
          source: 'RENTAL',
          startTime: '2026-11-10T14:45:00',
          endTime: '2026-11-10T17:00:00',
          status: 'CONFIRMED',
        },
        openISO,
        1,
        closeISO
      );

      const schedule = runAutoFill(sampleMovies, defaultConstraints, [r1, r2]);

      expect(schedule.length).toBeGreaterThan(0);

      // No movie scheduled in the 45-minute gap [14:00, 14:45]
      const gapStart = toMinutes('14:00'); // 840
      const gapEnd = toMinutes('14:45');   // 885

      for (const block of schedule) {
        const bStart = toMinutes(block.startTime);
        const bEnd = toMinutes(block.endTime);
        const insideGap = bStart < gapEnd && bEnd > gapStart;
        expect(insideGap).toBe(false);
      }

      // Valid slots before 12:00 and after 17:00 are scheduled
      const morningBlock = schedule.find((b) => toMinutes(b.endTime) <= toMinutes('12:00'));
      const eveningBlock = schedule.find((b) => toMinutes(b.startTime) >= toMinutes('17:00'));
      expect(morningBlock).toBeDefined();
      expect(eveningBlock).toBeDefined();

      const combined = detectConflicts([...schedule, r1, r2], toMinutes('08:00'));
      expect(combined.every((b) => !b.isConflict)).toBe(true);
    });

    it('handles overnight operating hours (08:00-02:00 next day) with late-evening rental (22:45-01:15)', () => {
      const openISO = '2026-11-10T08:00:00';
      const closeISO = '2026-11-11T02:00:00';

      const slot: BusySlot = {
        source: 'RENTAL',
        startTime: '2026-11-10T22:45:00',
        endTime: '2026-11-11T01:15:00',
        status: 'CONFIRMED',
      };

      const rentalBlock = rentalBusySlotToBlock(slot, openISO, 0, closeISO);

      expect(rentalBlock.startTime).toBe('22:45');
      expect(rentalBlock.endTime).toBe('01:15');
      expect(rentalBlock.offsetMinutes).toBe(885); // 14h45m = 885m
      expect(rentalBlock.totalMinutes).toBe(150); // 22:45 to 01:15 = 150m

      const overnightConstraints: ScheduleConstraints = {
        ...defaultConstraints,
        openTime: '08:00',
        closeTime: '02:00',
      };

      const schedule = runAutoFill(sampleMovies, overnightConstraints, [rentalBlock]);

      expect(schedule.length).toBeGreaterThan(0);

      // Verify no block overlaps 22:45 to 01:15 (linear minutes: 885 to 1035 from 08:00)
      const rentalLinearStart = 885;
      const rentalLinearEnd = 1035;

      for (const block of schedule) {
        const bStart = block.offsetMinutes;
        const bEnd = block.offsetMinutes + block.totalMinutes;
        const overlaps = bStart < rentalLinearEnd && bEnd > rentalLinearStart;
        expect(overlaps).toBe(false);
      }

      const combined = detectConflicts([...schedule, rentalBlock], toMinutes('08:00'));
      expect(combined.every((b) => !b.isConflict)).toBe(true);
    });
  });

  // ── 4. Conflict / Error Path ────────────────────────────────────────────────
  describe('Conflict / Error Path', () => {
    it('detectConflicts marks isConflict: true on both blocks when a movie block is dragged onto a locked rental block', () => {
      const rentalBlock: ShowtimeBlock = {
        id: 'rental-0-2026-11-10T13:45:00',
        title: 'Private Room Rental',
        startTime: '13:45',
        endTime: '16:15',
        totalMinutes: 150,
        colorClass: 'bg-amber-600',
        isLocked: true,
        isConflict: false,
        offsetMinutes: 345, // 13:45 - 08:00 = 345m
      };

      // Dragged movie block placed at 14:00-16:00 (inside rental window)
      const draggedMovieBlock: ShowtimeBlock = {
        id: 'dragged-movie-1',
        title: 'Overlapping Movie',
        startTime: '14:00',
        endTime: '16:00',
        totalMinutes: 120,
        colorClass: 'bg-primary',
        isLocked: false,
        isConflict: false,
        offsetMinutes: 360, // 14:00 - 08:00 = 360m
      };

      const validated = detectConflicts([rentalBlock, draggedMovieBlock], toMinutes('08:00'));

      const evaluatedRental = validated.find((b) => b.id === rentalBlock.id);
      const evaluatedMovie = validated.find((b) => b.id === draggedMovieBlock.id);

      expect(evaluatedRental?.isConflict).toBe(true);
      expect(evaluatedMovie?.isConflict).toBe(true);
    });

    it('detectConflicts marks isConflict: false when a movie block ends at exact 13:45 or starts at exact 16:15', () => {
      const rentalBlock: ShowtimeBlock = {
        id: 'rental-0-2026-11-10T13:45:00',
        title: 'Private Room Rental',
        startTime: '13:45',
        endTime: '16:15',
        totalMinutes: 150,
        colorClass: 'bg-amber-600',
        isLocked: true,
        isConflict: false,
        offsetMinutes: 345,
      };

      // Ends at exact 13:45
      const moviePre: ShowtimeBlock = {
        id: 'movie-pre',
        title: 'Morning Movie',
        startTime: '11:45',
        endTime: '13:45',
        totalMinutes: 120,
        colorClass: 'bg-emerald-500',
        isLocked: false,
        isConflict: false,
        offsetMinutes: 225, // 11:45 - 08:00 = 225m
      };

      // Starts at exact 16:15
      const moviePost: ShowtimeBlock = {
        id: 'movie-post',
        title: 'Evening Movie',
        startTime: '16:15',
        endTime: '18:15',
        totalMinutes: 120,
        colorClass: 'bg-violet-500',
        isLocked: false,
        isConflict: false,
        offsetMinutes: 495, // 16:15 - 08:00 = 495m
      };

      const validated = detectConflicts([moviePre, rentalBlock, moviePost], toMinutes('08:00'));

      expect(validated.every((b) => !b.isConflict)).toBe(true);
      expect(validated.find((b) => b.id === 'movie-pre')?.isConflict).toBe(false);
      expect(validated.find((b) => b.id === rentalBlock.id)?.isConflict).toBe(false);
      expect(validated.find((b) => b.id === 'movie-post')?.isConflict).toBe(false);
    });

    it('detectConflicts detects even a 1-minute overlap with a locked rental block', () => {
      const rentalBlock: ShowtimeBlock = {
        id: 'rental-0-2026-11-10T13:45:00',
        title: 'Private Room Rental',
        startTime: '13:45',
        endTime: '16:15',
        totalMinutes: 150,
        colorClass: 'bg-amber-600',
        isLocked: true,
        isConflict: false,
        offsetMinutes: 345,
      };

      // Overlaps by 1 minute: ends at 13:46 instead of 13:45
      const slightOverlapMovie: ShowtimeBlock = {
        id: 'movie-slight-overlap',
        title: 'Slight Overlap Movie',
        startTime: '11:45',
        endTime: '13:46',
        totalMinutes: 121,
        colorClass: 'bg-rose-500',
        isLocked: false,
        isConflict: false,
        offsetMinutes: 225,
      };

      const validated = detectConflicts([rentalBlock, slightOverlapMovie], toMinutes('08:00'));

      expect(validated.find((b) => b.id === rentalBlock.id)?.isConflict).toBe(true);
      expect(validated.find((b) => b.id === slightOverlapMovie.id)?.isConflict).toBe(true);
    });
  });
});
