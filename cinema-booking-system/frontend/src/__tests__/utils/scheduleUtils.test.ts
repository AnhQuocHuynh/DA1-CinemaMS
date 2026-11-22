import { describe, it, expect } from 'vitest';
import {
  toMinutes,
  toHHMM,
  addMinutes,
  toISO,
  getOperatingRange,
  computeFreeSlots,
  subtractIntervalFromSlots,
  detectConflicts,
  runAutoFill,
} from '../../utils/scheduleUtils';
import { ScheduleConstraints, ScheduledMovie, ShowtimeBlock } from '../../types/schedule';

describe('scheduleUtils – Time conversion & arithmetic', () => {
  it('converts HH:mm strings to total minutes from midnight', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('08:00')).toBe(480);
    expect(toMinutes('08:30')).toBe(510);
    expect(toMinutes('18:30')).toBe(1110);
    expect(toMinutes('23:45')).toBe(1425);
  });

  it('converts total minutes back to formatted HH:mm', () => {
    expect(toHHMM(0)).toBe('00:00');
    expect(toHHMM(480)).toBe('08:00');
    expect(toHHMM(510)).toBe('08:30');
    expect(toHHMM(1110)).toBe('18:30');
    expect(toHHMM(1425)).toBe('23:45');
  });

  it('adds minutes to HH:mm string correctly', () => {
    expect(addMinutes('08:30', 90)).toBe('10:00');
    expect(addMinutes('18:30', 140)).toBe('20:50');
    expect(addMinutes('23:00', 60)).toBe('00:00');
  });

  it('formats ISO 8601 string from date and HH:mm', () => {
    expect(toISO('2026-10-15', '18:30')).toBe('2026-10-15T18:30:00');
  });
});

describe('Phase 1: Free Slot Discovery & Interval Subtraction', () => {
  it('computes a single open-to-close slot when there are no locked blocks', () => {
    const open = toMinutes('08:00');
    const close = toMinutes('23:00');
    const slots = computeFreeSlots(open, close, []);

    expect(slots).toEqual([{ start: 480, end: 1380 }]);
  });

  it('splits open-to-close interval around a locked block in the middle', () => {
    const open = toMinutes('08:00'); // 480
    const close = toMinutes('23:00'); // 1380
    const lockedBlock: ShowtimeBlock = {
      id: 'event-1',
      title: 'Private Event',
      startTime: '13:00', // 780
      endTime: '15:00',   // 900
      totalMinutes: 120,
      colorClass: 'bg-slate-500',
      isLocked: true,
      isConflict: false,
      offsetMinutes: 300,
    };

    const slots = computeFreeSlots(open, close, [lockedBlock]);

    expect(slots).toEqual([
      { start: 480, end: 780 },
      { start: 900, end: 1380 },
    ]);
  });

  it('correctly handles locked blocks that touch operating boundaries', () => {
    const open = toMinutes('08:00'); // 480
    const close = toMinutes('22:00'); // 1320
    const lockedLeading: ShowtimeBlock = {
      id: 'early-event',
      title: 'Morning Cleaning',
      startTime: '08:00', // 480
      endTime: '09:00',   // 540
      totalMinutes: 60,
      colorClass: 'bg-slate-500',
      isLocked: true,
      isConflict: false,
      offsetMinutes: 0,
    };
    const lockedTrailing: ShowtimeBlock = {
      id: 'late-event',
      title: 'Midnight Maintenance',
      startTime: '21:00', // 1260
      endTime: '22:00',   // 1320
      totalMinutes: 60,
      colorClass: 'bg-slate-500',
      isLocked: true,
      isConflict: false,
      offsetMinutes: 780,
    };

    const slots = computeFreeSlots(open, close, [lockedLeading, lockedTrailing]);

    expect(slots).toEqual([{ start: 540, end: 1260 }]);
  });

  it('subtractIntervalFromSlots carves out an occupied sub-interval', () => {
    const initialSlots = [{ start: 500, end: 1000 }];
    // Occupy 600 to 750
    const updated = subtractIntervalFromSlots(initialSlots, 600, 750);

    expect(updated).toEqual([
      { start: 500, end: 600 },
      { start: 750, end: 1000 },
    ]);
  });
});

describe('Phase 2: Golden Hours Dual-Screening (Backward-Shift Heuristic)', () => {
  const constraints: ScheduleConstraints = {
    openTime: '08:30',
    closeTime: '23:45',
    cleaningTimeMinutes: 15,
    adsTimeMinutes: 10,
    goldenHoursStart: '18:30',
    goldenHoursEnd: '21:30',
    maxPreShiftMinutes: 50, // Allows shifting Movie 1 as early as 17:40
    staggerOffsetMinutes: 0,
  };

  const movies: ScheduledMovie[] = [
    {
      id: 1,
      title: 'Dune: Part Two (Blockbuster)',
      durationMinutes: 115,
      priority: 3, // Blockbuster
      isHot: true,
      colorClass: 'bg-primary',
    },
    {
      id: 2,
      title: 'Oppenheimer (High Demand)',
      durationMinutes: 110,
      priority: 2,
      isHot: false,
      colorClass: 'bg-violet-500',
    },
  ];

  it('places TWO prime movies in the evening via backward-shift lookback', () => {
    const schedule = runAutoFill(movies, constraints, []);

    // Buffer is 15 + 10 = 25 min.
    // M1 block total = 115 + 25 = 140 min.
    // M2 block total = 110 + 25 = 135 min.
    // Without pre-shift, rigid start at 18:30 -> ends at 20:50, leaving only 40 min before 21:30.
    // With backward-shift, target M2 is ~20:00, M1 is shifted to ~17:40 - 17:45.
    const eveningM1 = schedule.find((b) => b.movieId === 1 && toMinutes(b.startTime) >= toMinutes('17:30') && toMinutes(b.startTime) <= toMinutes('18:30'));
    const eveningM2 = schedule.find((b) => b.movieId === 2 && toMinutes(b.startTime) >= toMinutes('19:40') && toMinutes(b.startTime) <= toMinutes('20:30'));

    expect(eveningM1).toBeDefined();
    expect(eveningM2).toBeDefined();

    // Verify back-to-back continuity: M1 ends exactly when M2 starts
    if (eveningM1 && eveningM2) {
      expect(eveningM1.endTime).toBe(eveningM2.startTime);
    }
  });

  it('falls back to sequential/single fit when backward shift is blocked by an earlier event', () => {
    // Locked event from 16:00 to 18:30 blocks backward shift before 18:30
    const blockedEvent: ShowtimeBlock = {
      id: 'event-afternoon',
      title: 'Company Auditorium Booking',
      startTime: '16:00',
      endTime: '18:30',
      totalMinutes: 150,
      colorClass: 'bg-slate-500',
      isLocked: true,
      isConflict: false,
      offsetMinutes: 450,
    };

    const schedule = runAutoFill(movies, constraints, [blockedEvent]);

    // Should NOT schedule any block overlapping the locked event
    const overlapWithEvent = schedule.some((b) => {
      const start = toMinutes(b.startTime);
      const end = toMinutes(b.endTime);
      return start < toMinutes('18:30') && end > toMinutes('16:00');
    });
    expect(overlapWithEvent).toBe(false);

    // M1 should start at or after 18:30
    const primeMovie = schedule.find((b) => b.movieId === 1 && toMinutes(b.startTime) >= toMinutes('18:30'));
    expect(primeMovie).toBeDefined();
  });
});

describe('Phase 3: Weighted Round-Robin Catalog Distribution', () => {
  it('distributes slots proportionally according to movie priority weights (P3: 3x, P2: 2x, P1: 1x)', () => {
    const constraints: ScheduleConstraints = {
      openTime: '08:00',
      closeTime: '23:00', // 15 hours = 900 minutes
      cleaningTimeMinutes: 10,
      adsTimeMinutes: 5,  // total buffer = 15 min
      goldenHoursStart: '18:00',
      goldenHoursEnd: '21:00',
    };

    const movieP3: ScheduledMovie = { id: 10, title: 'Top Priority', durationMinutes: 75, priority: 3, colorClass: 'bg-primary' }; // block = 90 min
    const movieP2: ScheduledMovie = { id: 20, title: 'Mid Priority', durationMinutes: 75, priority: 2, colorClass: 'bg-emerald-500' };
    const movieP1: ScheduledMovie = { id: 30, title: 'Low Priority', durationMinutes: 75, priority: 1, colorClass: 'bg-amber-500' };

    const schedule = runAutoFill([movieP3, movieP2, movieP1], constraints, []);

    const countP3 = schedule.filter((b) => b.movieId === 10).length;
    const countP2 = schedule.filter((b) => b.movieId === 20).length;
    const countP1 = schedule.filter((b) => b.movieId === 30).length;

    // Highest priority movie should have the most screenings
    expect(countP3).toBeGreaterThanOrEqual(countP2);
    expect(countP2).toBeGreaterThanOrEqual(countP1);
    expect(countP3).toBeGreaterThan(countP1);
  });
});

describe('Phase 4: Knapsack Best-Fit Gap-Filling', () => {
  it('selects the largest fitting movie to utilize leftover slot capacity', () => {
    const constraints: ScheduleConstraints = {
      openTime: '20:00',
      closeTime: '23:30', // 210 minutes total
      cleaningTimeMinutes: 10,
      adsTimeMinutes: 5,  // 15 min buffer
      goldenHoursStart: '18:00',
      goldenHoursEnd: '20:00',
    };

    const longMovie: ScheduledMovie = { id: 1, title: 'Epic 3hr Film', durationMinutes: 170, priority: 1, colorClass: 'bg-primary' }; // block 185 min
    const mediumMovie: ScheduledMovie = { id: 2, title: 'Standard Film', durationMinutes: 80, priority: 1, colorClass: 'bg-emerald-500' }; // block 95 min
    const shortMovie: ScheduledMovie = { id: 3, title: 'Short Animation', durationMinutes: 50, priority: 1, colorClass: 'bg-amber-500' }; // block 65 min

    const baseMovie: ScheduledMovie = { id: 10, title: 'Main Feature', durationMinutes: 100, priority: 3, colorClass: 'bg-primary' }; // block 115 min

    const schedule = runAutoFill([baseMovie, longMovie, mediumMovie, shortMovie], constraints, []);

    // 210 - 115 = 95 min left.
    // longMovie (185 min) is too large.
    // mediumMovie (95 min) fits and is larger than shortMovie (65 min).
    // Knapsack Best-Fit should choose mediumMovie (95 min).
    const gapFillBlock = schedule.find((b) => b.movieId === 2);
    expect(gapFillBlock).toBeDefined();
  });
});

describe('Phase 5: Multi-Room Stagger Offset & Conflict Verification', () => {
  const constraints: ScheduleConstraints = {
    openTime: '09:00',
    closeTime: '23:00',
    cleaningTimeMinutes: 15,
    adsTimeMinutes: 10,
    staggerOffsetMinutes: 15,
  };

  const movies: ScheduledMovie[] = [
    { id: 1, title: 'Movie A', durationMinutes: 90, priority: 1, colorClass: 'bg-primary' },
  ];

  it('staggers effective start time across rooms', () => {
    const room0Schedule = runAutoFill(movies, constraints, [], 0);
    const room1Schedule = runAutoFill(movies, constraints, [], 1);
    const room2Schedule = runAutoFill(movies, constraints, [], 2);

    expect(room0Schedule[0].startTime).toBe('09:00');
    expect(room1Schedule[0].startTime).toBe('09:15');
    expect(room2Schedule[0].startTime).toBe('09:30');
  });

  it('guarantees zero collisions among all generated blocks', () => {
    const schedule = runAutoFill(
      [
        { id: 1, title: 'M1', durationMinutes: 105, priority: 3, isHot: true, colorClass: 'bg-primary' },
        { id: 2, title: 'M2', durationMinutes: 95, priority: 2, colorClass: 'bg-emerald-500' },
        { id: 3, title: 'M3', durationMinutes: 80, priority: 1, colorClass: 'bg-amber-500' },
      ],
      {
        openTime: '08:30',
        closeTime: '23:45',
        cleaningTimeMinutes: 15,
        adsTimeMinutes: 10,
        goldenHoursStart: '18:30',
        goldenHoursEnd: '21:30',
        maxPreShiftMinutes: 45,
        staggerOffsetMinutes: 10,
      },
      [],
      0
    );

    // Verify detectConflicts reports 0 conflicts
    expect(schedule.some((b) => b.isConflict)).toBe(false);

    // Verify mathematical non-overlap
    for (let i = 0; i < schedule.length - 1; i++) {
      const currentEnd = toMinutes(schedule[i].endTime);
      const nextStart = toMinutes(schedule[i + 1].startTime);
      expect(currentEnd).toBeLessThanOrEqual(nextStart);
    }
  });

  it('detectConflicts accurately flags overlapping blocks', () => {
    const open = toMinutes('08:00');
    const overlappingBlocks: ShowtimeBlock[] = [
      {
        id: 'b1',
        title: 'Block 1',
        startTime: '10:00',
        endTime: '12:00',
        totalMinutes: 120,
        colorClass: 'bg-primary',
        isLocked: false,
        isConflict: false,
        offsetMinutes: 120,
      },
      {
        id: 'b2',
        title: 'Block 2 (Colliding)',
        startTime: '11:30',
        endTime: '13:30',
        totalMinutes: 120,
        colorClass: 'bg-primary',
        isLocked: false,
        isConflict: false,
        offsetMinutes: 210,
      },
    ];

    const result = detectConflicts(overlappingBlocks, open);
    expect(result[0].isConflict).toBe(true);
    expect(result[1].isConflict).toBe(true);
  });
});

describe('Edge Cases & Boundary Conditions', () => {
  const defaultConstraints: ScheduleConstraints = {
    openTime: '08:00',
    closeTime: '23:00',
    cleaningTimeMinutes: 15,
    adsTimeMinutes: 10,
    goldenHoursStart: '18:30',
    goldenHoursEnd: '21:30',
  };

  it('returns an empty array when selectedMovies is empty', () => {
    const result = runAutoFill([], defaultConstraints, []);
    expect(result).toEqual([]);
  });

  it('returns an empty array when operating window is smaller than movie length + buffers', () => {
    const shortConstraints: ScheduleConstraints = {
      openTime: '10:00',
      closeTime: '10:30', // only 30 minutes
      cleaningTimeMinutes: 15,
      adsTimeMinutes: 10,  // buffer is 25 min -> leaves 5 min for movie
    };
    const movie: ScheduledMovie = { id: 1, title: 'Film', durationMinutes: 90, priority: 1, colorClass: 'bg-primary' };

    const result = runAutoFill([movie], shortConstraints, []);
    expect(result).toEqual([]);
  });

  it('returns empty array when entire day is covered by a locked event', () => {
    const fullDayLocked: ShowtimeBlock = {
      id: 'full-day-conference',
      title: 'Full Day Cinema Rental',
      startTime: '08:00',
      endTime: '23:00',
      totalMinutes: 900,
      colorClass: 'bg-slate-500',
      isLocked: true,
      isConflict: false,
      offsetMinutes: 0,
    };
    const movie: ScheduledMovie = { id: 1, title: 'Film', durationMinutes: 90, priority: 1, colorClass: 'bg-primary' };

    const result = runAutoFill([movie], defaultConstraints, [fullDayLocked]);
    expect(result).toEqual([]);
  });

  it('handles large room stagger offsets gracefully without exceeding close time', () => {
    const constraintsWithLargeStagger: ScheduleConstraints = {
      openTime: '22:00',
      closeTime: '23:00', // only 60 minutes
      cleaningTimeMinutes: 5,
      adsTimeMinutes: 5,
      staggerOffsetMinutes: 45,
    };
    const movie: ScheduledMovie = { id: 1, title: 'Short Film', durationMinutes: 30, priority: 1, colorClass: 'bg-primary' }; // block = 40 min

    // Room 0: open at 22:00, fits 40 min block (22:00 to 22:40)
    const room0 = runAutoFill([movie], constraintsWithLargeStagger, [], 0);
    expect(room0.length).toBe(1);

    // Room 1: effectiveOpen = 22:00 + 45 min = 22:45. Remaining before 23:00 is 15 min < 40 min block.
    const room1 = runAutoFill([movie], constraintsWithLargeStagger, [], 1);
    expect(room1.length).toBe(0);
  });
});

describe('Overnight & 24/7 Operating Hours Handling', () => {
  it('getOperatingRange correctly calculates same-day, overnight, and 24/7 spans', () => {
    // Same day: 08:00 to 23:00 -> 900 minutes
    const sameDay = getOperatingRange('08:00', '23:00');
    expect(sameDay.open).toBe(480);
    expect(sameDay.close).toBe(1380);
    expect(sameDay.totalMinutes).toBe(900);

    // Overnight: 20:00 to 02:00 next day -> 360 minutes
    const overnight = getOperatingRange('20:00', '02:00');
    expect(overnight.open).toBe(1200);
    expect(overnight.close).toBe(1560); // 2:00 AM + 1440
    expect(overnight.totalMinutes).toBe(360);

    // 24/7 shift: 06:00 to 05:45 next day -> 1425 minutes (23h 45m)
    const continuous24 = getOperatingRange('06:00', '05:45');
    expect(continuous24.open).toBe(360);
    expect(continuous24.close).toBe(1785); // 5:45 AM + 1440
    expect(continuous24.totalMinutes).toBe(1425);

    // 24/7 exact round: 06:00 to 06:00 next day -> 1440 minutes (24h)
    const exact24 = getOperatingRange('06:00', '06:00');
    expect(exact24.open).toBe(360);
    expect(exact24.close).toBe(1800);
    expect(exact24.totalMinutes).toBe(1440);
  });

  it('toISO correctly rolls over calendar dates for post-midnight screenings', () => {
    expect(toISO('2026-10-15', '22:30', 0)).toBe('2026-10-15T22:30:00');
    expect(toISO('2026-10-15', '01:15', 1)).toBe('2026-10-16T01:15:00');
  });

  it('computes free slots across an overnight window and subtracts locked blocks crossing midnight', () => {
    // Window: 20:00 (1200) to 02:30 (1590)
    const open = 1200;
    const close = 1590;

    // Locked late-night event from 23:30 to 00:30 (1410 to 1470)
    const midnightEvent: ShowtimeBlock = {
      id: 'midnight-event',
      title: 'Midnight Premiere',
      startTime: '23:30',
      endTime: '00:30',
      totalMinutes: 60,
      colorClass: 'bg-slate-500',
      isLocked: true,
      isConflict: false,
      offsetMinutes: 210, // 1410 - 1200
    };

    const slots = computeFreeSlots(open, close, [midnightEvent]);

    expect(slots).toEqual([
      { start: 1200, end: 1410 }, // 20:00 to 23:30
      { start: 1470, end: 1590 }, // 00:30 to 02:30
    ]);
  });

  it('packs movies across an overnight shift (20:00 to 03:00) with zero conflicts', () => {
    const overnightConstraints: ScheduleConstraints = {
      openTime: '20:00',
      closeTime: '03:00', // 7 hours overnight = 420 minutes
      cleaningTimeMinutes: 15,
      adsTimeMinutes: 10,  // buffer = 25 min
      goldenHoursStart: '20:30',
      goldenHoursEnd: '22:30',
    };

    const movies: ScheduledMovie[] = [
      { id: 1, title: 'Late Night Thriller', durationMinutes: 100, priority: 3, isHot: true, colorClass: 'bg-primary' }, // total 125 min
      { id: 2, title: 'Comedy', durationMinutes: 80, priority: 2, colorClass: 'bg-emerald-500' }, // total 105 min
    ];

    const schedule = runAutoFill(movies, overnightConstraints, []);

    expect(schedule.length).toBeGreaterThan(0);
    expect(schedule.some((b) => b.isConflict)).toBe(false);

    // Verify screenings continue past midnight (finish after 00:00, i.e. offset + totalMinutes > 240)
    const midnightSpanningBlock = schedule.find((b) => {
      return b.offsetMinutes + b.totalMinutes > 240;
    });
    expect(midnightSpanningBlock).toBeDefined();
    // Verify it ends in the early morning of the next day (e.g. 01:55 < 23:50)
    if (midnightSpanningBlock) {
      expect(toMinutes(midnightSpanningBlock.endTime)).toBeLessThan(toMinutes(midnightSpanningBlock.startTime));
    }

    // Verify chronological non-overlap using linear offsets
    for (let i = 0; i < schedule.length - 1; i++) {
      const currentEnd = schedule[i].offsetMinutes + schedule[i].totalMinutes;
      const nextStart = schedule[i + 1].offsetMinutes;
      expect(currentEnd).toBeLessThanOrEqual(nextStart);
    }
  });

  it('packs movies across a 24/7 continuous schedule (06:00 to 05:45 next day) with zero conflicts', () => {
    const continuous24Constraints: ScheduleConstraints = {
      openTime: '06:00',
      closeTime: '05:45', // 23h 45m = 1425 minutes
      cleaningTimeMinutes: 15,
      adsTimeMinutes: 10, // buffer = 25 min
      goldenHoursStart: '18:30',
      goldenHoursEnd: '21:30',
    };

    const movies: ScheduledMovie[] = [
      { id: 1, title: 'Blockbuster', durationMinutes: 110, priority: 3, isHot: true, colorClass: 'bg-primary' }, // total 135 min
      { id: 2, title: 'Action Film', durationMinutes: 95, priority: 2, colorClass: 'bg-emerald-500' }, // total 120 min
      { id: 3, title: 'Family Animation', durationMinutes: 75, priority: 1, colorClass: 'bg-amber-500' }, // total 100 min
    ];

    const schedule = runAutoFill(movies, continuous24Constraints, []);

    // A full 24-hour cycle should fit 8–11 screenings
    expect(schedule.length).toBeGreaterThanOrEqual(8);
    expect(schedule.some((b) => b.isConflict)).toBe(false);

    // Verify all consecutive blocks do not overlap
    for (let i = 0; i < schedule.length - 1; i++) {
      const currentEnd = schedule[i].offsetMinutes + schedule[i].totalMinutes;
      const nextStart = schedule[i + 1].offsetMinutes;
      expect(currentEnd).toBeLessThanOrEqual(nextStart);
    }

    // Verify schedule starts at or after 06:00 and ends at or before 05:45 (offset 1425 min)
    expect(schedule[0].startTime).toBe('06:00');
    const lastBlock = schedule[schedule.length - 1];
    expect(lastBlock.offsetMinutes + lastBlock.totalMinutes).toBeLessThanOrEqual(1425);
  });

  it('guarantees zero collisions when two consecutive 24/7 days touch at boundary', () => {
    const dayConstraints: ScheduleConstraints = {
      openTime: '06:00',
      closeTime: '05:45', // Day 1 ends at 05:45
      cleaningTimeMinutes: 15,
      adsTimeMinutes: 10,
    };

    const movie: ScheduledMovie = { id: 1, title: 'Film', durationMinutes: 90, priority: 1, colorClass: 'bg-primary' }; // 115 min block

    const day1Schedule = runAutoFill([movie], dayConstraints, []);
    const day2Schedule = runAutoFill([movie], dayConstraints, []);

    // Day 1 last block end
    const day1Last = day1Schedule[day1Schedule.length - 1];
    const day1LastEndOffset = day1Last.offsetMinutes + day1Last.totalMinutes; // minutes from Day 1 06:00

    // Day 1 must finish by 05:45 (offset 1425 from 06:00)
    expect(day1LastEndOffset).toBeLessThanOrEqual(1425);

    // Day 2 first block begins at 06:00 (offset 1440 from Day 1 06:00)
    // Hence Day 1 and Day 2 touch or have buffer, but never collide
    expect(day1LastEndOffset).toBeLessThanOrEqual(1440);
    expect(day2Schedule[0].startTime).toBe('06:00');
  });
});

describe('Overnight Operating Hours (Open until 00:30)', () => {
  it('correctly calculates operating range for morning-to-past-midnight (10:00 to 00:30)', () => {
    const range = getOperatingRange('10:00', '00:30');
    expect(range.open).toBe(600); // 10:00
    expect(range.close).toBe(1470); // 00:30 + 1440
    expect(range.totalMinutes).toBe(870); // 14.5 hours
  });

  it('schedules accurately for rooms open from morning until 00:30 past midnight', () => {
    const constraints: ScheduleConstraints = {
      openTime: '10:00',
      closeTime: '00:30',
      cleaningTimeMinutes: 15,
      adsTimeMinutes: 10, // buffer 25 min
      goldenHoursStart: '18:30',
      goldenHoursEnd: '21:30',
      maxPreShiftMinutes: 45,
    };

    const movies: ScheduledMovie[] = [
      { id: 1, title: 'Blockbuster Hero', durationMinutes: 110, priority: 3, isHot: true, colorClass: 'bg-primary' }, // 135m block
      { id: 2, title: 'Romantic Drama', durationMinutes: 95, priority: 2, colorClass: 'bg-violet-500' }, // 120m block
      { id: 3, title: 'Indie Comedy', durationMinutes: 75, priority: 1, colorClass: 'bg-amber-500' }, // 100m block
    ];

    const schedule = runAutoFill(movies, constraints, []);

    expect(schedule.length).toBeGreaterThan(0);
    expect(schedule.some((b) => b.isConflict)).toBe(false);

    // Verify schedule starts at 10:00
    expect(schedule[0].startTime).toBe('10:00');

    // Verify last screening finishes at or before 00:30 (offset + totalMinutes <= 870)
    const lastBlock = schedule[schedule.length - 1];
    expect(lastBlock.offsetMinutes + lastBlock.totalMinutes).toBeLessThanOrEqual(870);

    // Verify that at least one block crosses or finishes close to midnight
    const lateBlock = schedule.find((b) => b.offsetMinutes + b.totalMinutes > 800); // after 23:20
    expect(lateBlock).toBeDefined();

    // Verify chronological non-overlap using linear offsets
    for (let i = 0; i < schedule.length - 1; i++) {
      const currentEnd = schedule[i].offsetMinutes + schedule[i].totalMinutes;
      const nextStart = schedule[i + 1].offsetMinutes;
      expect(currentEnd).toBeLessThanOrEqual(nextStart);
    }
  });

  it('schedules a late evening shift operating till 00:30 (18:00 to 00:30)', () => {
    const constraints: ScheduleConstraints = {
      openTime: '18:00',
      closeTime: '00:30', // 390 minutes total (6.5 hours)
      cleaningTimeMinutes: 15,
      adsTimeMinutes: 10,
      goldenHoursStart: '19:00',
      goldenHoursEnd: '21:30',
      maxPreShiftMinutes: 30,
    };

    const movies: ScheduledMovie[] = [
      { id: 1, title: 'Headline Premiere', durationMinutes: 105, priority: 3, isHot: true, colorClass: 'bg-primary' }, // 130m
      { id: 2, title: 'Late Thriller', durationMinutes: 85, priority: 2, colorClass: 'bg-emerald-500' }, // 110m
    ];

    const schedule = runAutoFill(movies, constraints, []);

    expect(schedule.length).toBeGreaterThanOrEqual(2);
    expect(schedule.some((b) => b.isConflict)).toBe(false);

    // Prime movie placed in Golden Hours
    const primeMovie = schedule.find((b) => b.movieId === 1);
    expect(primeMovie).toBeDefined();

    // Last block finishes by 00:30 (390 min from 18:00)
    const lastBlock = schedule[schedule.length - 1];
    expect(lastBlock.offsetMinutes + lastBlock.totalMinutes).toBeLessThanOrEqual(390);
  });
});

describe('Continuous 24/24 Operating Hours & Multi-Room Staggering', () => {
  it('packs a complete 24-hour continuous operating cycle (06:00 to 06:00 next day, 1440 minutes)', () => {
    const round24Constraints: ScheduleConstraints = {
      openTime: '06:00',
      closeTime: '06:00', // exact 24 hours = 1440 minutes
      cleaningTimeMinutes: 15,
      adsTimeMinutes: 10, // buffer 25 min
      goldenHoursStart: '18:30',
      goldenHoursEnd: '21:30',
    };

    const movies: ScheduledMovie[] = [
      { id: 1, title: 'Epic Blockbuster', durationMinutes: 110, priority: 3, isHot: true, colorClass: 'bg-primary' }, // 135m
      { id: 2, title: 'Sci-Fi Adventure', durationMinutes: 95, priority: 2, colorClass: 'bg-violet-500' }, // 120m
      { id: 3, title: 'Family Cartoon', durationMinutes: 70, priority: 1, colorClass: 'bg-amber-500' }, // 95m
    ];

    const schedule = runAutoFill(movies, round24Constraints, []);

    // Full 24 hours should fit 8 to 12 screenings
    expect(schedule.length).toBeGreaterThanOrEqual(8);
    expect(schedule.some((b) => b.isConflict)).toBe(false);

    // First block starts at 06:00
    expect(schedule[0].startTime).toBe('06:00');

    // Last block ends before or exactly at 1440 min (06:00 next day)
    const lastBlock = schedule[schedule.length - 1];
    expect(lastBlock.offsetMinutes + lastBlock.totalMinutes).toBeLessThanOrEqual(1440);

    // All blocks in sequence are strictly non-overlapping
    for (let i = 0; i < schedule.length - 1; i++) {
      const currentEnd = schedule[i].offsetMinutes + schedule[i].totalMinutes;
      const nextStart = schedule[i + 1].offsetMinutes;
      expect(currentEnd).toBeLessThanOrEqual(nextStart);
    }
  });

  it('coordinates multi-room staggering across a continuous 24/24 schedule', () => {
    const continuousConstraints: ScheduleConstraints = {
      openTime: '06:00',
      closeTime: '05:45', // 1425 minutes
      cleaningTimeMinutes: 15,
      adsTimeMinutes: 10,
      staggerOffsetMinutes: 15,
    };

    const movie: ScheduledMovie = {
      id: 1,
      title: 'Action Flick',
      durationMinutes: 95,
      priority: 2,
      colorClass: 'bg-primary',
    }; // 120m block

    const room0 = runAutoFill([movie], continuousConstraints, [], 0);
    const room1 = runAutoFill([movie], continuousConstraints, [], 1);
    const room2 = runAutoFill([movie], continuousConstraints, [], 2);

    expect(room0[0].startTime).toBe('06:00');
    expect(room1[0].startTime).toBe('06:15');
    expect(room2[0].startTime).toBe('06:30');

    // Every room finishes cleanly within the 24/24 boundary
    expect(room0[room0.length - 1].offsetMinutes + room0[room0.length - 1].totalMinutes).toBeLessThanOrEqual(1425);
    expect(room1[room1.length - 1].offsetMinutes + room1[room1.length - 1].totalMinutes).toBeLessThanOrEqual(1425);
    expect(room2[room2.length - 1].offsetMinutes + room2[room2.length - 1].totalMinutes).toBeLessThanOrEqual(1425);

    // Zero internal conflicts
    expect(room0.some((b) => b.isConflict)).toBe(false);
    expect(room1.some((b) => b.isConflict)).toBe(false);
    expect(room2.some((b) => b.isConflict)).toBe(false);
  });
});

describe('Inter-Day Multi-Day Interactions (Boundary Touching & Spillover Protection)', () => {
  it('verifies seamless chronological transition when Day 1 and Day 2 touch at the 24/24 boundary', () => {
    const dayConstraints: ScheduleConstraints = {
      openTime: '06:00',
      closeTime: '05:45', // closes at 05:45 + 15m buffer = 06:00 next day
      cleaningTimeMinutes: 15,
      adsTimeMinutes: 10,
    };

    const movie: ScheduledMovie = { id: 1, title: 'Continuous Cinema', durationMinutes: 95, priority: 2, colorClass: 'bg-primary' };

    const day1Schedule = runAutoFill([movie], dayConstraints, []);
    const day2Schedule = runAutoFill([movie], dayConstraints, []);

    const day1Date = '2026-10-15';
    const day2Date = '2026-10-16';

    // Day 1 last block
    const day1Last = day1Schedule[day1Schedule.length - 1];
    const day1EndLinear = 360 + day1Last.offsetMinutes + day1Last.totalMinutes;
    const day1EndDayOffset = Math.floor(day1EndLinear / 1440);
    const day1LastEndISO = toISO(day1Date, day1Last.endTime, day1EndDayOffset);

    // Day 2 first block
    const day2First = day2Schedule[0];
    const day2StartLinear = 360 + day2First.offsetMinutes;
    const day2StartDayOffset = Math.floor(day2StartLinear / 1440);
    const day2FirstStartISO = toISO(day2Date, day2First.startTime, day2StartDayOffset);

    // Day 1 last end time must be before or equal to Day 2 first start time (2026-10-16T06:00:00)
    expect(day1LastEndISO <= day2FirstStartISO).toBe(true);
    expect(day2FirstStartISO).toBe('2026-10-16T06:00:00');
  });

  it('protects Day 2 when a Day 1 spillover or late-night screening extends into Day 2 morning', () => {
    const day2Constraints: ScheduleConstraints = {
      openTime: '06:00',
      closeTime: '05:45',
      cleaningTimeMinutes: 15,
      adsTimeMinutes: 10, // buffer 25m
    };

    // Spillover from Day 1 late screening that finishes at 06:45 on Day 2
    const day1Spillover: ShowtimeBlock = {
      id: 'day1-spillover-screening',
      title: 'Midnight Marathon (Day 1 Spillover)',
      startTime: '06:00',
      endTime: '06:45',
      totalMinutes: 45,
      colorClass: 'bg-slate-500',
      isLocked: true,
      isConflict: false,
      offsetMinutes: 0,
    };

    const movie: ScheduledMovie = { id: 1, title: 'Morning Show', durationMinutes: 75, priority: 2, colorClass: 'bg-primary' }; // 100m block

    const day2Schedule = runAutoFill([movie], day2Constraints, [day1Spillover]);

    // First auto-filled block on Day 2 must start at or after 06:45
    expect(day2Schedule.length).toBeGreaterThan(0);
    const firstGenerated = day2Schedule[0];
    expect(toMinutes(firstGenerated.startTime)).toBeGreaterThanOrEqual(toMinutes('06:45'));

    // Verify zero conflict with the locked spillover block
    const allBlocks = detectConflicts([day1Spillover, ...day2Schedule], toMinutes('06:00'));
    expect(allBlocks.some((b) => b.isConflict)).toBe(false);
  });
});

describe('Knapsack Best-Fit Trade-offs: Capacity Utilization vs Movie Priority', () => {
  it('selects 1 larger movie over a short movie when the larger movie eliminates wasted gap capacity', () => {
    // Operating window of 130 minutes
    const constraints: ScheduleConstraints = {
      openTime: '21:00',
      closeTime: '23:10', // 130 minutes total
      cleaningTimeMinutes: 15,
      adsTimeMinutes: 10, // buffer 25m
      goldenHoursStart: '18:00',
      goldenHoursEnd: '20:00',
    };

    // Movie A: 105 min duration + 25m buffer = 130 min block (exact fit, 0 wasted min)
    const movieHighMed: ScheduledMovie = {
      id: 1,
      title: 'Featured Thriller (Med/High)',
      durationMinutes: 105,
      priority: 2,
      colorClass: 'bg-primary',
    };
    // Movie B: 60 min duration + 25m buffer = 85 min block (leaves 45 min dead air if picked alone)
    const movieLow: ScheduledMovie = {
      id: 2,
      title: 'Short Cartoon (Low)',
      durationMinutes: 60,
      priority: 1,
      colorClass: 'bg-amber-500',
    };

    const schedule = runAutoFill([movieHighMed, movieLow], constraints, []);

    // Knapsack chooses movieHighMed because 130m fits and maximizes capacity utilization (100% vs 65%)
    expect(schedule.length).toBe(1);
    expect(schedule[0].movieId).toBe(1);
    expect(schedule[0].totalMinutes).toBe(130);
  });

  it('packs multiple shorter movies when combined they utilize capacity that a single long film cannot fill', () => {
    // Operating window of 170 minutes
    const constraints: ScheduleConstraints = {
      openTime: '13:00',
      closeTime: '15:50', // 170 minutes total
      cleaningTimeMinutes: 10,
      adsTimeMinutes: 5, // buffer 15m
      goldenHoursStart: '18:00',
      goldenHoursEnd: '21:00',
    };

    // Movie Long: 135 min + 15m buffer = 150m block (leaves 20m dead air if scheduled alone)
    const movieLong: ScheduledMovie = {
      id: 10,
      title: 'Long Historical Drama',
      durationMinutes: 135,
      priority: 3,
      colorClass: 'bg-primary',
    };
    // Movie Short: 70 min + 15m buffer = 85m block (two blocks = 170m exact fit, 0m dead air)
    const movieShort: ScheduledMovie = {
      id: 20,
      title: 'Family Comedy',
      durationMinutes: 70,
      priority: 1,
      colorClass: 'bg-amber-500',
    };

    const schedule = runAutoFill([movieShort, movieLong], constraints, []);

    // Round-robin / packing fits TWO short movies back-to-back: 85m + 85m = 170m
    const shortCount = schedule.filter((b) => b.movieId === 20).length;
    expect(shortCount).toBe(2);
    expect(schedule.reduce((sum, b) => sum + b.totalMinutes, 0)).toBe(170);
  });

  it('prioritizes high-priority movies with 3x frequency in round-robin before filling remaining tail gaps', () => {
    const constraints: ScheduleConstraints = {
      openTime: '08:00',
      closeTime: '23:00', // 900 minutes
      cleaningTimeMinutes: 10,
      adsTimeMinutes: 5, // 15m buffer
      goldenHoursStart: '18:00',
      goldenHoursEnd: '21:00',
    };

    const movieP3: ScheduledMovie = { id: 30, title: 'Summer Tentpole', durationMinutes: 75, priority: 3, colorClass: 'bg-primary' }; // 90m block
    const movieP1: ScheduledMovie = { id: 10, title: 'Indie Short Doc', durationMinutes: 75, priority: 1, colorClass: 'bg-amber-500' }; // 90m block

    const schedule = runAutoFill([movieP3, movieP1], constraints, []);

    const countP3 = schedule.filter((b) => b.movieId === 30).length;
    const countP1 = schedule.filter((b) => b.movieId === 10).length;

    // P3 should receive ~3x the screenings of P1
    expect(countP3).toBeGreaterThan(countP1);
    expect(countP3).toBeGreaterThanOrEqual(3);
  });
});

describe('Admin Showtime Block Moving & Timeline Drag-and-Drop Interaction', () => {
  const openTime = '10:00';
  const closeTime = '02:00'; // 16 hours = 960 minutes (overnight)
  const { open } = getOperatingRange(openTime, closeTime);

  it('detects no conflict when admin moves a block cleanly to an empty timeline space', () => {
    const blocks: ShowtimeBlock[] = [
      {
        id: 'b1',
        title: 'Morning Show',
        startTime: '10:00',
        endTime: '12:00',
        totalMinutes: 120,
        colorClass: 'bg-primary',
        isLocked: false,
        isConflict: false,
        offsetMinutes: 0,
      },
      {
        id: 'b2',
        title: 'Afternoon Show',
        startTime: '13:00',
        endTime: '15:00',
        totalMinutes: 120,
        colorClass: 'bg-violet-500',
        isLocked: false,
        isConflict: false,
        offsetMinutes: 180,
      },
    ];

    // Admin moves b2 from 13:00 (offset 180) to 15:30 (offset 330)
    const newOffset = 330;
    const movedB2: ShowtimeBlock = {
      ...blocks[1],
      startTime: toHHMM(open + newOffset),
      endTime: toHHMM(open + newOffset + blocks[1].totalMinutes),
      offsetMinutes: newOffset,
    };

    const checked = detectConflicts([blocks[0], movedB2], open);
    expect(checked.some((b) => b.isConflict)).toBe(false);
    expect(checked[1].startTime).toBe('15:30');
    expect(checked[1].endTime).toBe('17:30');
  });

  it('accurately flags conflicts when admin drags a block into an overlapping position across midnight', () => {
    // Block 1: 23:00 to 01:00 (offset: 780 to 900 min from 10:00)
    const blockLate: ShowtimeBlock = {
      id: 'b-late',
      title: 'Midnight Premiere',
      startTime: '23:00',
      endTime: '01:00',
      totalMinutes: 120,
      colorClass: 'bg-primary',
      isLocked: false,
      isConflict: false,
      offsetMinutes: 780,
    };

    // Block 2 moved to 00:30 to 02:00 (offset: 870 to 960 min from 10:00) -> overlaps Block 1 between 00:30 and 01:00
    const blockMoved: ShowtimeBlock = {
      id: 'b-moved',
      title: 'Night Owl Thriller',
      startTime: '00:30',
      endTime: '02:00',
      totalMinutes: 90,
      colorClass: 'bg-emerald-500',
      isLocked: false,
      isConflict: false,
      offsetMinutes: 870,
    };

    const result = detectConflicts([blockLate, blockMoved], open);

    expect(result[0].isConflict).toBe(true);
    expect(result[1].isConflict).toBe(true);
  });

  it('resolves conflicts immediately when admin drags conflicting block to clear space past midnight', () => {
    const blockLate: ShowtimeBlock = {
      id: 'b-late',
      title: 'Midnight Premiere',
      startTime: '23:00',
      endTime: '00:30',
      totalMinutes: 90,
      colorClass: 'bg-primary',
      isLocked: false,
      isConflict: true,
      offsetMinutes: 780, // 23:00
    };

    // Admin moves second block after 00:30 (e.g. 00:35 to 02:00, offset 875)
    const resolvedMoved: ShowtimeBlock = {
      id: 'b-moved',
      title: 'Night Owl Thriller',
      startTime: '00:35',
      endTime: '02:00',
      totalMinutes: 85,
      colorClass: 'bg-emerald-500',
      isLocked: false,
      isConflict: true,
      offsetMinutes: 875,
    };

    const result = detectConflicts([blockLate, resolvedMoved], open);

    expect(result[0].isConflict).toBe(false);
    expect(result[1].isConflict).toBe(false);
  });

  it('correctly maps startDayOffset and endDayOffset to ISO strings when publishing overnight blocks', () => {
    const date = '2026-10-15';

    // Block 1: Same day afternoon (14:00 to 16:00, offset 240, linear 840)
    const block1Offset = 240;
    const b1StartLinear = open + block1Offset;
    const b1EndLinear = b1StartLinear + 120;
    const b1StartISO = toISO(date, toHHMM(b1StartLinear), Math.floor(b1StartLinear / 1440));
    const b1EndISO = toISO(date, toHHMM(b1EndLinear), Math.floor(b1EndLinear / 1440));
    expect(b1StartISO).toBe('2026-10-15T14:00:00');
    expect(b1EndISO).toBe('2026-10-15T16:00:00');

    // Block 2: Crosses midnight (23:15 to 01:15, offset 795, linear 1395)
    const block2Offset = 795;
    const b2StartLinear = open + block2Offset; // 1395 min (< 1440 min -> day 0)
    const b2EndLinear = b2StartLinear + 120;   // 1515 min (>= 1440 min -> day 1)
    const b2StartISO = toISO(date, toHHMM(b2StartLinear), Math.floor(b2StartLinear / 1440));
    const b2EndISO = toISO(date, toHHMM(b2EndLinear), Math.floor(b2EndLinear / 1440));
    expect(b2StartISO).toBe('2026-10-15T23:15:00');
    expect(b2EndISO).toBe('2026-10-16T01:15:00'); // Rolls over to 10-16

    // Block 3: Fully post-midnight (01:20 to 02:00, offset 920, linear 1520)
    const block3Offset = 920;
    const b3StartLinear = open + block3Offset; // 1520 min (day 1)
    const b3EndLinear = b3StartLinear + 40;    // 1560 min (day 1)
    const b3StartISO = toISO(date, toHHMM(b3StartLinear), Math.floor(b3StartLinear / 1440));
    const b3EndISO = toISO(date, toHHMM(b3EndLinear), Math.floor(b3EndLinear / 1440));
    expect(b3StartISO).toBe('2026-10-16T01:20:00'); // Rolls over to 10-16
    expect(b3EndISO).toBe('2026-10-16T02:00:00'); // Rolls over to 10-16
  });
});

