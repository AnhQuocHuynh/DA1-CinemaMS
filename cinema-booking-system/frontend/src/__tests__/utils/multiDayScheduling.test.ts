import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import {
  runAutoFill,
  detectConflicts,
  getOperatingRange,
} from '../../utils/scheduleUtils';
import { ScheduleConstraints, ScheduledMovie, ShowtimeBlock } from '../../types/schedule';

describe('Multi-Day Scheduling Logic & Date Range Isolation', () => {
  const constraints: ScheduleConstraints = {
    openTime: '08:30',
    closeTime: '23:45',
    cleaningTimeMinutes: 15,
    adsTimeMinutes: 10,
    goldenHoursStart: '18:30',
    goldenHoursEnd: '21:30',
    maxPreShiftMinutes: 45,
    staggerOffsetMinutes: 15,
  };

  it('generates a contiguous date list for a date range up to max limit', () => {
    const startDate = '2026-10-11';
    const endDate = '2026-10-17';

    const dates: string[] = [];
    let curr = dayjs(startDate);
    const end = dayjs(endDate);
    const maxDays = 14;
    let count = 0;

    while ((curr.isBefore(end, 'day') || curr.isSame(end, 'day')) && count < maxDays) {
      dates.push(curr.format('YYYY-MM-DD'));
      curr = curr.add(1, 'day');
      count++;
    }

    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe('2026-10-11');
    expect(dates[6]).toBe('2026-10-17');
  });

  it('correctly filters movies per-day according to their release dates across the range', () => {
    const allMovies = [
      { id: 1, title: 'Already Released', releaseDate: '2026-09-01', durationMinutes: 120, priority: 2 },
      { id: 2, title: 'Releases on Oct 14', releaseDate: '2026-10-14', durationMinutes: 100, priority: 3 },
      { id: 3, title: 'Releases on Oct 20 (Future)', releaseDate: '2026-10-20', durationMinutes: 110, priority: 2 },
    ];

    const rangeDates = ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'];

    const scheduledByDate: Record<string, number[]> = {};

    for (const d of rangeDates) {
      const availableOnDay = allMovies.filter((m) => !dayjs(d).isBefore(dayjs(m.releaseDate), 'day'));
      scheduledByDate[d] = availableOnDay.map((m) => m.id);
    }

    // Oct 11 - Oct 13: Only movie 1 is released
    expect(scheduledByDate['2026-10-11']).toEqual([1]);
    expect(scheduledByDate['2026-10-12']).toEqual([1]);
    expect(scheduledByDate['2026-10-13']).toEqual([1]);

    // Oct 14 - Oct 15: Movies 1 and 2 are released
    expect(scheduledByDate['2026-10-14']).toEqual([1, 2]);
    expect(scheduledByDate['2026-10-15']).toEqual([1, 2]);

    // Movie 3 is never released in this range
    for (const d of rangeDates) {
      expect(scheduledByDate[d]).not.toContain(3);
    }
  });

  it('isolates existing bookings between different days', () => {
    const day1Existing: ShowtimeBlock[] = [
      {
        id: 'existing-day1-1',
        title: 'Special Premiere',
        startTime: '19:00',
        endTime: '21:30',
        totalMinutes: 150,
        colorClass: 'bg-slate-500',
        isLocked: true,
        isConflict: false,
        offsetMinutes: 630,
      },
    ];

    const day2Existing: ShowtimeBlock[] = []; // Day 2 has no bookings

    const movies: ScheduledMovie[] = [
      { id: 1, title: 'Blockbuster', durationMinutes: 120, priority: 3, isHot: true, colorClass: 'bg-emerald-500' },
      { id: 2, title: 'Comedy', durationMinutes: 90, priority: 2, isHot: false, colorClass: 'bg-blue-500' },
    ];

    const day1Filled = runAutoFill(movies, constraints, day1Existing);
    const day2Filled = runAutoFill(movies, constraints, day2Existing);

    // Day 1 has locked block at 19:00, so generated blocks on Day 1 cannot overlap with 19:00-21:30
    const { open } = getOperatingRange(constraints.openTime, constraints.closeTime);
    const day1Conflicts = detectConflicts([...day1Existing, ...day1Filled], open);
    const day2Conflicts = detectConflicts([...day2Existing, ...day2Filled], open);

    expect(day1Conflicts.some((b) => b.isConflict)).toBe(false);
    expect(day2Conflicts.some((b) => b.isConflict)).toBe(false);

    // Day 2 was completely free, so it successfully schedules both movies
    const day2Blockbuster = day2Filled.find((b) => b.title === 'Blockbuster');
    const day2Comedy = day2Filled.find((b) => b.title === 'Comedy');
    expect(day2Blockbuster).toBeDefined();
    expect(day2Comedy).toBeDefined();
    expect(day2Filled.length).toBeGreaterThan(0);
  });
});
