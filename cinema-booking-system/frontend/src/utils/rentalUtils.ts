import dayjs from 'dayjs';
import { BusySlot } from '../types/rental';
import { ShowtimeBlock } from '../types/schedule';

/**
 * Returns true if the given start time falls on a weekend (Saturday or Sunday).
 * Returns false on empty or invalid date input.
 */
export function isWeekendWindow(startTimeISO: string): boolean {
  if (!startTimeISO) return false;
  const d = dayjs(startTimeISO);
  if (!d.isValid()) return false;
  const day = d.day(); // 0 is Sunday, 6 is Saturday
  return day === 0 || day === 6;
}

/**
 * Matches backend RentalService.overlapsPeak:
 * Iterates each calendar day from start.startOf('day') to end.startOf('day'),
 * computes peakStart = day.hour(peakStartHour).minute(0).second(0) and
 * peakEnd = day.hour(peakEndHour).minute(0).second(0).
 * Returns true if start.isBefore(peakEnd) && end.isAfter(peakStart).
 * Returns false if input is invalid or end is not after start.
 */
export function overlapsPeakHours(
  startTimeISO: string,
  endTimeISO: string,
  peakStartHour = 18,
  peakEndHour = 22
): boolean {
  if (!startTimeISO || !endTimeISO) return false;
  const start = dayjs(startTimeISO);
  const end = dayjs(endTimeISO);
  if (!start.isValid() || !end.isValid() || !end.isAfter(start)) {
    return false;
  }

  let currentDay = start.startOf('day');
  const lastDay = end.startOf('day');

  while (!currentDay.isAfter(lastDay)) {
    const peakStart = currentDay.hour(peakStartHour).minute(0).second(0).millisecond(0);
    const peakEnd = currentDay.hour(peakEndHour).minute(0).second(0).millisecond(0);

    if (start.isBefore(peakEnd) && end.isAfter(peakStart)) {
      return true;
    }
    currentDay = currentDay.add(1, 'day');
  }

  return false;
}

/**
 * Returns true iff dayjs(startTimeISO) is valid and NOT before dayjs(nowMs).add(minHoursBefore, 'hour').
 * Matches backend Java rule: !startTime.isBefore(now.plusHours(24)).
 */
export function canCustomerCancelConfirmed(
  startTimeISO: string,
  nowMs: number = Date.now(),
  minHoursBefore = 24
): boolean {
  if (!startTimeISO) return false;
  const start = dayjs(startTimeISO);
  if (!start.isValid()) return false;
  const deadline = dayjs(nowMs).add(minHoursBefore, 'hour');
  return !start.isBefore(deadline);
}

/**
 * Returns true iff dayjs(startTimeISO) is valid and strictly after dayjs(nowMs).
 * Matches backend Java rule: startTime.isAfter(now).
 */
export function canStaffCancelConfirmed(
  startTimeISO: string,
  nowMs: number = Date.now()
): boolean {
  if (!startTimeISO) return false;
  const start = dayjs(startTimeISO);
  if (!start.isValid()) return false;
  return start.isAfter(dayjs(nowMs));
}

/**
 * Maps rental unavailable code to human-readable message.
 */
export function getUnavailableReasonMessage(code: string | null | undefined): string {
  switch (code) {
    case 'SHOWTIME_OVERLAP':
      return 'This time window overlaps with a scheduled movie showtime (including 15-minute cleaning buffer).';
    case 'ROOM_SLOT_TAKEN':
      return 'This room is already reserved for another rental during the selected time.';
    case 'MOVIE_DOES_NOT_FIT':
      return "The rental window is too short for the selected movie's runtime plus 15-minute buffer.";
    case 'ROOM_UNAVAILABLE':
      return 'This room is currently under maintenance or inactive.';
    case 'ROOM_RATE_MISSING':
      return 'This room does not have a configured rental rate yet.';
    default:
      return 'The selected time window is unavailable.';
  }
}

/**
 * Converts a BusySlot (private room rental) into a ShowtimeBlock for display on schedule timeline.
 * Clamps effective start/end to operating hours (openISO / closeISO) so that buffer-extended
 * slots do not result in negative offsetMinutes or overflow beyond closing time.
 */
export function rentalBusySlotToBlock(
  slot: BusySlot,
  openISO: string,
  index = 0,
  closeISO?: string
): ShowtimeBlock {
  const start = dayjs(slot.startTime);
  const end = dayjs(slot.endTime);
  const open = dayjs(openISO);

  const effectiveStart = start.isBefore(open) ? open : start;
  const effectiveEnd =
    closeISO && dayjs(closeISO).isValid() && end.isAfter(dayjs(closeISO))
      ? dayjs(closeISO)
      : end;

  return {
    id: `rental-${index}-${slot.startTime}`,
    title: 'Private Room Rental',
    startTime: effectiveStart.format('HH:mm'),
    endTime: effectiveEnd.format('HH:mm'),
    totalMinutes: Math.max(0, effectiveEnd.diff(effectiveStart, 'minute')),
    colorClass: 'bg-amber-600',
    isLocked: true,
    isConflict: false,
    offsetMinutes: Math.max(0, effectiveStart.diff(open, 'minute')),
  };
}
