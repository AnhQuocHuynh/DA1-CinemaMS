// ── Auto Showtime Creator – shared types ──────────────────────────────────────

export interface ScheduleConstraints {
  openTime: string;      // "HH:mm"
  closeTime: string;     // "HH:mm"
  cleaningTimeMinutes: number;
  adsTimeMinutes: number;
  goldenHoursStart?: string;      // "HH:mm", e.g. "18:30"
  goldenHoursEnd?: string;        // "HH:mm", e.g. "21:30"
  maxPreShiftMinutes?: number;    // e.g. 45-60
  staggerOffsetMinutes?: number;  // e.g. 15
}

/** A coloured block on the timeline – either a movie screening or an event slot */
export interface ShowtimeBlock {
  /** Temporary id (e.g. "block-0") or backend showtime id when saved */
  id: string;
  movieId?: number;
  eventId?: number;
  /** Title shown on the block */
  title: string;
  /** HH:mm for the entire slot (ads + movie/event + cleaning) */
  startTime: string;
  endTime: string;
  /** Total minutes this block occupies on the timeline */
  totalMinutes: number;
  /** Movie-only: duration of the film itself in minutes */
  movieDurationMinutes?: number;
  /** Tailwind-compatible background colour class */
  colorClass: string;
  /** Events are immovable hard blocks */
  isLocked: boolean;
  /** Detected overlap with another block */
  isConflict: boolean;
  /** Offset from the start of operating hours in minutes – used for positioning */
  offsetMinutes: number;
}

export interface ScheduledMovie {
  id: number;
  title: string;
  durationMinutes: number;
  /** Priority weight (1 = Standard, 2 = High Demand, 3 = Blockbuster / Golden Hour) */
  priority: number;
  isHot?: boolean;
  colorClass: string;
}

export interface CachedMoviePriority {
  priority: number;
  isHot?: boolean;
  updatedAt?: string;
}

/** Payload sent to POST /showtimes for each block */
export interface CreateShowtimePayload {
  roomId: number;
  movieId?: number;
  eventId?: number;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  basePrice: number;
}
