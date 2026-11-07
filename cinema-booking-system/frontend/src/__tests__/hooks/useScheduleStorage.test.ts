import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_CONSTRAINTS,
  SCHEDULE_CONFIG_KEY,
  MOVIE_PRIORITIES_KEY,
  loadStoredConstraints,
  saveStoredConstraints,
  resetStoredConstraints,
  loadStoredMoviePriorities,
  saveStoredMoviePriority,
} from '../../hooks/useScheduleStorage';
import { ScheduleConstraints } from '../../types/schedule';

describe('useScheduleStorage – Browser LocalStorage Persistence', () => {
  // Simple in-memory localStorage polyfill for testing environment
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    for (const key in mockStorage) {
      delete mockStorage[key];
    }

    globalThis.localStorage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => {
        for (const key in mockStorage) {
          delete mockStorage[key];
        }
      },
      length: 0,
      key: () => null,
    };
  });

  it('loads DEFAULT_CONSTRAINTS when localStorage is empty', () => {
    const loaded = loadStoredConstraints();
    expect(loaded).toEqual(DEFAULT_CONSTRAINTS);
  });

  it('saves and reloads custom schedule constraints', () => {
    const custom: ScheduleConstraints = {
      openTime: '09:00',
      closeTime: '01:00',
      cleaningTimeMinutes: 20,
      adsTimeMinutes: 15,
      goldenHoursStart: '19:00',
      goldenHoursEnd: '22:00',
      maxPreShiftMinutes: 60,
      staggerOffsetMinutes: 20,
    };

    saveStoredConstraints(custom);
    const loaded = loadStoredConstraints();

    expect(loaded).toEqual(custom);
    expect(localStorage.getItem(SCHEDULE_CONFIG_KEY)).toBeDefined();
  });

  it('resets constraints back to DEFAULT_CONSTRAINTS', () => {
    saveStoredConstraints({
      openTime: '10:00',
      closeTime: '22:00',
      cleaningTimeMinutes: 25,
      adsTimeMinutes: 20,
    });

    const reset = resetStoredConstraints();
    expect(reset).toEqual(DEFAULT_CONSTRAINTS);
    expect(localStorage.getItem(SCHEDULE_CONFIG_KEY)).toBeNull();
  });

  it('saves and retrieves movie priorities and hot flags', () => {
    expect(loadStoredMoviePriorities()).toEqual({});

    saveStoredMoviePriority(101, 3, true);
    saveStoredMoviePriority(102, 2, false);

    const loaded = loadStoredMoviePriorities();
    expect(loaded[101]).toBeDefined();
    expect(loaded[101].priority).toBe(3);
    expect(loaded[101].isHot).toBe(true);
    expect(loaded[102].priority).toBe(2);
    expect(loaded[102].isHot).toBe(false);
  });

  it('gracefully handles malformed JSON in localStorage', () => {
    mockStorage[SCHEDULE_CONFIG_KEY] = 'not-valid-json{{{';
    mockStorage[MOVIE_PRIORITIES_KEY] = 'invalid-json';

    const constraints = loadStoredConstraints();
    expect(constraints).toEqual(DEFAULT_CONSTRAINTS);

    const priorities = loadStoredMoviePriorities();
    expect(priorities).toEqual({});
  });
});
