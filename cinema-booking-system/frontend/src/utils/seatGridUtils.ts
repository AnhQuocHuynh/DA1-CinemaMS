import { Seat, SeatRow, SeatType } from '../types/booking';
import { ShowtimeSeatResponse } from '../types/showtime';
import { parseVND } from './formatters';

export type SeatCell = {
  id: string;
  type: SeatType | null;
  coveredByLeft?: boolean;
};

/**
 * Converts a 0-based row index to an alphabetical label (0 -> "A", 25 -> "Z", 26 -> "AA").
 */
export const getRowLabel = (index: number): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (index < alphabet.length) return alphabet[index];
  const first = Math.floor(index / alphabet.length) - 1;
  const second = index % alphabet.length;
  return `${alphabet[first]}${alphabet[second]}`;
};

/**
 * Converts an alphabetical row label back to a 0-based numeric index ("A" -> 0, "Z" -> 25, "AA" -> 26).
 */
export const getRowIndex = (label: string): number => {
  if (!label) return 0;
  const cleanLabel = label.trim().toUpperCase();
  let index = 0;
  for (let i = 0; i < cleanLabel.length; i++) {
    index = index * 26 + (cleanLabel.charCodeAt(i) - 64);
  }
  return Math.max(0, index - 1);
};

/**
 * Safely parses any seat type code string (e.g., "STANDARD", "VIP", "COUPLE", null) into a valid SeatType.
 */
export const normalizeSeatType = (typeCode?: string | null): SeatType => {
  if (!typeCode) return 'standard';
  const clean = typeCode.toString().trim().toLowerCase();
  if (clean === 'vip' || clean === 'couple') return clean;
  return 'standard';
};

/**
 * Generates an empty 2D matrix of SeatCells for the configurator grid.
 */
export const buildGrid = (rows: number, columns: number, previous?: SeatCell[][]): SeatCell[][] =>
  Array.from({ length: rows }, (_, rowIndex) =>
    Array.from({ length: columns }, (_, colIndex) => {
      const existing = previous?.[rowIndex]?.[colIndex];
      return {
        id: existing?.id ?? `seat-${rowIndex}-${colIndex}`,
        type: existing?.type ?? null,
        coveredByLeft: existing?.coveredByLeft ?? false,
      };
    })
  );

/**
 * Maps a flat array of backend seat templates into a 2D matrix (SeatCell[][]) for the seat configurator.
 */
export const mapSeatsToGrid = (
  seats: any[],
  initialRows?: number,
  initialColumns?: number,
  defaultRows = 10,
  defaultColumns = 14
): { rows: number; columns: number; grid: SeatCell[][] } => {
  let maxRow = 0;
  let maxCol = 0;

  if (seats && seats.length > 0) {
    seats.forEach((seat) => {
      if (!seat.rowLabel || typeof seat.columnNumber !== 'number') return;
      const rIndex = getRowIndex(seat.rowLabel);
      maxRow = Math.max(maxRow, rIndex);
      maxCol = Math.max(maxCol, seat.columnNumber - 1);
    });
  }

  const rows = initialRows && initialRows > 0 ? initialRows : Math.max(defaultRows, maxRow + 1);
  const columns = initialColumns && initialColumns > 0 ? initialColumns : Math.max(defaultColumns, maxCol + 1);

  const grid = buildGrid(rows, columns);

  if (seats && seats.length > 0) {
    seats.forEach((seat) => {
      if (!seat.rowLabel || typeof seat.columnNumber !== 'number') return;
      const rIndex = getRowIndex(seat.rowLabel);
      const cIndex = seat.columnNumber - 1;
      if (rIndex >= 0 && rIndex < rows && cIndex >= 0 && cIndex < columns) {
        grid[rIndex][cIndex].type = normalizeSeatType(seat.seatTypeCode);
        if (seat.columnSpan > 1 && cIndex + 1 < columns) {
          grid[rIndex][cIndex + 1].coveredByLeft = true;
        }
      }
    });
  }

  return { rows, columns, grid };
};

/**
 * Groups a flat array of showtime seat responses by rowLabel and sorts them for the booking screen.
 */
export const groupSeatsByRow = (apiSeats: ShowtimeSeatResponse[]): SeatRow[] => {
  const rowMap = new Map<string, Seat[]>();

  for (const s of apiSeats) {
    const seat: Seat = {
      id: String(s.id),
      numericId: s.id,
      label: s.label,
      row: s.rowLabel,
      number: s.columnNumber,
      status: (s.pathway || s.isPathway) ? 'available' : (s.status as Seat['status']),
      type: normalizeSeatType(s.seatType),
      columnSpan: s.columnSpan || 1,
      price: parseVND(s.price),
      isPathway: s.pathway || s.isPathway,
    };

    if (!rowMap.has(s.rowLabel)) {
      rowMap.set(s.rowLabel, []);
    }
    rowMap.get(s.rowLabel)!.push(seat);
  }

  return Array.from(rowMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([rowLabel, seats]) => ({
      rowLabel,
      seats: seats.sort((a, b) => a.number - b.number),
    }));
};
