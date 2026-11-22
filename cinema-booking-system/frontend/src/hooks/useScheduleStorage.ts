import { useState, useCallback } from 'react';
import { ScheduleConstraints, CachedMoviePriority } from '../types/schedule';

export const SCHEDULE_CONFIG_KEY = 'cinema_admin_schedule_config';
export const MOVIE_PRIORITIES_KEY = 'cinema_admin_movie_priorities';

export const DEFAULT_CONSTRAINTS: ScheduleConstraints = {
  openTime: '08:30',
  closeTime: '23:45',
  cleaningTimeMinutes: 15,
  adsTimeMinutes: 10,
  goldenHoursStart: '18:30',
  goldenHoursEnd: '21:30',
  maxPreShiftMinutes: 45,
  staggerOffsetMinutes: 15,
};

export function loadStoredConstraints(): ScheduleConstraints {
  try {
    const raw = localStorage.getItem(SCHEDULE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        openTime: parsed.openTime || DEFAULT_CONSTRAINTS.openTime,
        closeTime: parsed.closeTime || DEFAULT_CONSTRAINTS.closeTime,
        cleaningTimeMinutes: typeof parsed.cleaningTimeMinutes === 'number' ? parsed.cleaningTimeMinutes : DEFAULT_CONSTRAINTS.cleaningTimeMinutes,
        adsTimeMinutes: typeof parsed.adsTimeMinutes === 'number' ? parsed.adsTimeMinutes : DEFAULT_CONSTRAINTS.adsTimeMinutes,
        goldenHoursStart: parsed.goldenHoursStart || DEFAULT_CONSTRAINTS.goldenHoursStart,
        goldenHoursEnd: parsed.goldenHoursEnd || DEFAULT_CONSTRAINTS.goldenHoursEnd,
        maxPreShiftMinutes: typeof parsed.maxPreShiftMinutes === 'number' ? parsed.maxPreShiftMinutes : DEFAULT_CONSTRAINTS.maxPreShiftMinutes,
        staggerOffsetMinutes: typeof parsed.staggerOffsetMinutes === 'number' ? parsed.staggerOffsetMinutes : DEFAULT_CONSTRAINTS.staggerOffsetMinutes,
      };
    }
  } catch (err) {
    console.error('Failed to parse schedule constraints from localStorage:', err);
  }
  return { ...DEFAULT_CONSTRAINTS };
}

export function saveStoredConstraints(constraints: ScheduleConstraints): void {
  try {
    localStorage.setItem(SCHEDULE_CONFIG_KEY, JSON.stringify(constraints));
  } catch (err) {
    console.error('Failed to save schedule constraints to localStorage:', err);
  }
}

export function resetStoredConstraints(): ScheduleConstraints {
  try {
    localStorage.removeItem(SCHEDULE_CONFIG_KEY);
  } catch (err) {
    console.error('Failed to reset schedule constraints in localStorage:', err);
  }
  return { ...DEFAULT_CONSTRAINTS };
}

export function loadStoredMoviePriorities(): Record<number, CachedMoviePriority> {
  try {
    const raw = localStorage.getItem(MOVIE_PRIORITIES_KEY);
    if (raw) {
      return JSON.parse(raw) as Record<number, CachedMoviePriority>;
    }
  } catch (err) {
    console.error('Failed to parse movie priorities from localStorage:', err);
  }
  return {};
}

export function saveStoredMoviePriority(movieId: number, priority: number, isHot = false): void {
  try {
    const existing = loadStoredMoviePriorities();
    existing[movieId] = {
      priority,
      isHot,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(MOVIE_PRIORITIES_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error('Failed to save movie priority to localStorage:', err);
  }
}

export function useScheduleStorage() {
  const [constraints, setConstraintsState] = useState<ScheduleConstraints>(loadStoredConstraints);
  const [moviePriorities, setMoviePrioritiesState] = useState<Record<number, CachedMoviePriority>>(loadStoredMoviePriorities);

  const saveConstraints = useCallback((newConstraints: ScheduleConstraints) => {
    saveStoredConstraints(newConstraints);
    setConstraintsState(newConstraints);
  }, []);

  const resetConstraints = useCallback(() => {
    const defaults = resetStoredConstraints();
    setConstraintsState(defaults);
    return defaults;
  }, []);

  const setMoviePriority = useCallback((movieId: number, priority: number, isHot = false) => {
    saveStoredMoviePriority(movieId, priority, isHot);
    setMoviePrioritiesState((prev) => ({
      ...prev,
      [movieId]: { priority, isHot, updatedAt: new Date().toISOString() },
    }));
  }, []);

  return {
    constraints,
    setConstraints: setConstraintsState,
    saveConstraints,
    resetConstraints,
    moviePriorities,
    setMoviePriority,
  };
}
