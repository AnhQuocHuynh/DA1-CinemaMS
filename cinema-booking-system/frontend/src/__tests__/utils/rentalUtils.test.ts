import { describe, it, expect } from 'vitest';
import {
  isWeekendWindow,
  overlapsPeakHours,
  canCustomerCancelConfirmed,
  canStaffCancelConfirmed,
  getUnavailableReasonMessage,
  rentalBusySlotToBlock,
} from '../../utils/rentalUtils';
import { BusySlot } from '../../types/rental';

describe('rentalUtils', () => {
  describe('isWeekendWindow', () => {
    it('returns true for Saturday', () => {
      // 2026-11-14 is Saturday
      expect(isWeekendWindow('2026-11-14T10:00:00')).toBe(true);
    });

    it('returns true for Sunday', () => {
      // 2026-11-15 is Sunday
      expect(isWeekendWindow('2026-11-15T18:00:00')).toBe(true);
    });

    it('returns false for weekdays (Monday through Friday)', () => {
      // 2026-11-09 is Monday, 2026-11-13 is Friday
      expect(isWeekendWindow('2026-11-09T09:00:00')).toBe(false);
      expect(isWeekendWindow('2026-11-11T12:00:00')).toBe(false);
      expect(isWeekendWindow('2026-11-13T21:00:00')).toBe(false);
    });

    it('returns false for invalid or empty string', () => {
      expect(isWeekendWindow('')).toBe(false);
      expect(isWeekendWindow('not-a-date')).toBe(false);
    });
  });

  describe('overlapsPeakHours', () => {
    // Default peak: 18:00 to 22:00
    it('returns true when window is completely inside peak hours', () => {
      expect(
        overlapsPeakHours('2026-11-10T19:00:00', '2026-11-10T21:00:00')
      ).toBe(true);
    });

    it('returns true when window overlaps start of peak hours', () => {
      expect(
        overlapsPeakHours('2026-11-10T17:30:00', '2026-11-10T19:00:00')
      ).toBe(true);
    });

    it('returns true when window overlaps end of peak hours', () => {
      expect(
        overlapsPeakHours('2026-11-10T21:00:00', '2026-11-10T23:00:00')
      ).toBe(true);
    });

    it('returns true when window completely spans over peak hours', () => {
      expect(
        overlapsPeakHours('2026-11-10T16:00:00', '2026-11-10T23:00:00')
      ).toBe(true);
    });

    it('returns true when window exactly matches peak hours (18:00 - 22:00)', () => {
      expect(
        overlapsPeakHours('2026-11-10T18:00:00', '2026-11-10T22:00:00')
      ).toBe(true);
    });

    it('returns false at exact boundaries without overlap', () => {
      // Window ends exactly at peak start (18:00) -> no overlap
      expect(
        overlapsPeakHours('2026-11-10T16:00:00', '2026-11-10T18:00:00')
      ).toBe(false);

      // Window starts exactly at peak end (22:00) -> no overlap
      expect(
        overlapsPeakHours('2026-11-10T22:00:00', '2026-11-10T23:30:00')
      ).toBe(false);
    });

    it('returns false when window is completely outside peak hours on the same day', () => {
      expect(
        overlapsPeakHours('2026-11-10T09:00:00', '2026-11-10T12:00:00')
      ).toBe(false);
    });

    it('handles multi-day window overlapping peak on one of the days', () => {
      // Multi-day window from day 1 morning to day 2 night
      expect(
        overlapsPeakHours('2026-11-10T10:00:00', '2026-11-11T21:00:00')
      ).toBe(true);
    });

    it('returns false for overnight window that stays in off-peak hours across midnight', () => {
      // 23:00 to 05:00 next day
      expect(
        overlapsPeakHours('2026-11-10T23:00:00', '2026-11-11T05:00:00')
      ).toBe(false);
    });

    it('supports custom peak hours', () => {
      // Custom peak 12:00 to 14:00
      expect(
        overlapsPeakHours('2026-11-10T13:00:00', '2026-11-10T15:00:00', 12, 14)
      ).toBe(true);
      expect(
        overlapsPeakHours('2026-11-10T15:00:00', '2026-11-10T17:00:00', 12, 14)
      ).toBe(false);
    });

    it('returns false for invalid inputs or inverted ranges', () => {
      expect(overlapsPeakHours('', '2026-11-10T20:00:00')).toBe(false);
      expect(overlapsPeakHours('2026-11-10T20:00:00', '')).toBe(false);
      expect(overlapsPeakHours('not-date', '2026-11-10T20:00:00')).toBe(false);
      // End before or equal to start
      expect(
        overlapsPeakHours('2026-11-10T20:00:00', '2026-11-10T18:00:00')
      ).toBe(false);
      expect(
        overlapsPeakHours('2026-11-10T19:00:00', '2026-11-10T19:00:00')
      ).toBe(false);
    });
  });

  describe('canCustomerCancelConfirmed', () => {
    const fixedNowMs = new Date('2026-11-10T10:00:00').getTime();

    it('returns true when start time is more than 24 hours ahead', () => {
      // 26 hours ahead
      const startTime = '2026-11-11T12:00:00';
      expect(canCustomerCancelConfirmed(startTime, fixedNowMs)).toBe(true);
    });

    it('returns true on exact 24h boundary', () => {
      // Exactly 24 hours ahead (not before deadline)
      const startTime = '2026-11-11T10:00:00';
      expect(canCustomerCancelConfirmed(startTime, fixedNowMs)).toBe(true);
    });

    it('returns false when start time is less than 24 hours ahead', () => {
      // 23 hours 59 minutes ahead
      const startTime = '2026-11-11T09:59:00';
      expect(canCustomerCancelConfirmed(startTime, fixedNowMs)).toBe(false);
    });

    it('returns false when start time is in the past', () => {
      const startTime = '2026-11-09T10:00:00';
      expect(canCustomerCancelConfirmed(startTime, fixedNowMs)).toBe(false);
    });

    it('supports custom minHoursBefore parameter', () => {
      // Custom 48h boundary
      const startTime30h = '2026-11-11T16:00:00';
      const startTime50h = '2026-11-12T12:00:00';

      expect(canCustomerCancelConfirmed(startTime30h, fixedNowMs, 48)).toBe(false);
      expect(canCustomerCancelConfirmed(startTime50h, fixedNowMs, 48)).toBe(true);
    });

    it('returns false for empty or invalid date input', () => {
      expect(canCustomerCancelConfirmed('', fixedNowMs)).toBe(false);
      expect(canCustomerCancelConfirmed('invalid-date', fixedNowMs)).toBe(false);
    });
  });

  describe('canStaffCancelConfirmed', () => {
    const fixedNowMs = new Date('2026-11-10T10:00:00').getTime();

    it('returns true when start time is strictly after now', () => {
      const startTime = '2026-11-10T10:00:01';
      expect(canStaffCancelConfirmed(startTime, fixedNowMs)).toBe(true);
    });

    it('returns false when start time is exact now', () => {
      const startTime = '2026-11-10T10:00:00';
      expect(canStaffCancelConfirmed(startTime, fixedNowMs)).toBe(false);
    });

    it('returns false when start time is in the past', () => {
      const startTime = '2026-11-10T09:59:59';
      expect(canStaffCancelConfirmed(startTime, fixedNowMs)).toBe(false);
    });

    it('returns false for empty or invalid date input', () => {
      expect(canStaffCancelConfirmed('', fixedNowMs)).toBe(false);
      expect(canStaffCancelConfirmed('not-valid', fixedNowMs)).toBe(false);
    });
  });

  describe('getUnavailableReasonMessage', () => {
    it('maps SHOWTIME_OVERLAP to correct message', () => {
      expect(getUnavailableReasonMessage('SHOWTIME_OVERLAP')).toBe(
        'This time window overlaps with a scheduled movie showtime (including 15-minute cleaning buffer).'
      );
    });

    it('maps ROOM_SLOT_TAKEN to correct message', () => {
      expect(getUnavailableReasonMessage('ROOM_SLOT_TAKEN')).toBe(
        'This room is already reserved for another rental during the selected time.'
      );
    });

    it('maps MOVIE_DOES_NOT_FIT to correct message', () => {
      expect(getUnavailableReasonMessage('MOVIE_DOES_NOT_FIT')).toBe(
        "The rental window is too short for the selected movie's runtime plus 15-minute buffer."
      );
    });

    it('maps ROOM_UNAVAILABLE to correct message', () => {
      expect(getUnavailableReasonMessage('ROOM_UNAVAILABLE')).toBe(
        'This room is currently under maintenance or inactive.'
      );
    });

    it('maps ROOM_RATE_MISSING to correct message', () => {
      expect(getUnavailableReasonMessage('ROOM_RATE_MISSING')).toBe(
        'This room does not have a configured rental rate yet.'
      );
    });

    it('falls back to default message for null, undefined, or unrecognized code', () => {
      expect(getUnavailableReasonMessage(null)).toBe('The selected time window is unavailable.');
      expect(getUnavailableReasonMessage(undefined)).toBe('The selected time window is unavailable.');
      expect(getUnavailableReasonMessage('SOME_UNKNOWN_CODE')).toBe('The selected time window is unavailable.');
    });
  });

  describe('rentalBusySlotToBlock', () => {
    it('converts BusySlot to ShowtimeBlock with correct properties', () => {
      const slot: BusySlot = {
        source: 'RENTAL',
        startTime: '2026-11-10T14:30:00',
        endTime: '2026-11-10T16:45:00',
        status: 'CONFIRMED',
      };
      const openISO = '2026-11-10T08:00:00';

      const block = rentalBusySlotToBlock(slot, openISO, 3);

      expect(block).toEqual({
        id: 'rental-3-2026-11-10T14:30:00',
        title: 'Private Room Rental',
        startTime: '14:30',
        endTime: '16:45',
        totalMinutes: 135,
        colorClass: 'bg-amber-600',
        isLocked: true,
        isConflict: false,
        offsetMinutes: 390, // from 08:00 to 14:30 = 6.5h * 60 = 390 min
      });
    });

    it('defaults index to 0 when not provided', () => {
      const slot: BusySlot = {
        source: 'RENTAL',
        startTime: '2026-11-10T10:00:00',
        endTime: '2026-11-10T11:00:00',
        status: 'CONFIRMED',
      };
      const openISO = '2026-11-10T08:00:00';

      const block = rentalBusySlotToBlock(slot, openISO);
      expect(block.id).toBe('rental-0-2026-11-10T10:00:00');
      expect(block.totalMinutes).toBe(60);
      expect(block.offsetMinutes).toBe(120);
    });

    it('clamps negative duration to 0 if endTime is before startTime', () => {
      const slot: BusySlot = {
        source: 'RENTAL',
        startTime: '2026-11-10T15:00:00',
        endTime: '2026-11-10T14:00:00',
        status: 'CONFIRMED',
      };
      const openISO = '2026-11-10T08:00:00';

      const block = rentalBusySlotToBlock(slot, openISO, 1);
      expect(block.totalMinutes).toBe(0);
    });

    it('clamps slot.startTime to openISO when slot starts before opening hours', () => {
      // Rental at 08:00 with 15-minute cleaning buffer starts at 07:45
      const slot: BusySlot = {
        source: 'RENTAL',
        startTime: '2026-11-10T07:45:00',
        endTime: '2026-11-10T10:00:00',
        status: 'CONFIRMED',
      };
      const openISO = '2026-11-10T08:00:00';

      const block = rentalBusySlotToBlock(slot, openISO, 0);

      expect(block.startTime).toBe('08:00');
      expect(block.endTime).toBe('10:00');
      expect(block.offsetMinutes).toBe(0); // Not -15! Clamped to 0
      expect(block.totalMinutes).toBe(120); // 08:00 to 10:00 = 120 minutes
      expect(block.id).toBe('rental-0-2026-11-10T07:45:00'); // Preserves slot startTime in id
    });

    it('clamps slot.endTime to closeISO when slot extends beyond closing hours', () => {
      const slot: BusySlot = {
        source: 'RENTAL',
        startTime: '2026-11-10T21:00:00',
        endTime: '2026-11-10T23:30:00',
        status: 'CONFIRMED',
      };
      const openISO = '2026-11-10T08:00:00';
      const closeISO = '2026-11-10T23:00:00';

      const block = rentalBusySlotToBlock(slot, openISO, 1, closeISO);

      expect(block.startTime).toBe('21:00');
      expect(block.endTime).toBe('23:00'); // Clamped to 23:00
      expect(block.totalMinutes).toBe(120); // 21:00 to 23:00 = 120 minutes
      expect(block.offsetMinutes).toBe(780); // from 08:00 to 21:00 = 13h = 780 min
    });

    it('clamps both startTime and endTime when slot spans across open and close bounds', () => {
      const slot: BusySlot = {
        source: 'RENTAL',
        startTime: '2026-11-10T07:30:00',
        endTime: '2026-11-10T23:30:00',
        status: 'CONFIRMED',
      };
      const openISO = '2026-11-10T08:00:00';
      const closeISO = '2026-11-10T23:00:00';

      const block = rentalBusySlotToBlock(slot, openISO, 2, closeISO);

      expect(block.startTime).toBe('08:00');
      expect(block.endTime).toBe('23:00');
      expect(block.offsetMinutes).toBe(0);
      expect(block.totalMinutes).toBe(900); // 15 hours = 900 minutes
    });
  });
});
