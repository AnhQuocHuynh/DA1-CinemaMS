// Types mirroring the backend API responses for showtimes and seats

export type ShowtimeStatus = 'SCHEDULED' | 'ONGOING' | 'FINISHED' | 'CANCELLED';
export type ShowtimeSeatStatus = 'available' | 'holding' | 'sold';
export type ShowtimeSeatType = 'normal' | 'vip' | 'couple';

export interface ShowtimeResponse {
  id: number;
  roomId: number;
  movieId: number | null;
  eventId: number | null;
  startTime: string; // ISO 8601 datetime
  endTime: string;
  basePrice: string; // decimal string e.g. "150000.00"
  status: ShowtimeStatus;
  createdAt: string;
  roomName?: string;
  cinemaId?: number;
  cinemaName?: string;
}

/** One entry from GET /showtimes/{id}/seats */
export interface ShowtimeSeatResponse {
  id: number;           // ShowtimeSeat PK — used for seatIds in hold/order
  seatId: string;
  showtimeId: number;
  seatTemplateId: number;
  label: string;        // e.g. "A1"
  rowLabel: string;     // e.g. "A"
  columnNumber: number;
  seatType: ShowtimeSeatType;
  isPathway: boolean;
  price: string;        // decimal string e.g. "150000.00"
  status: ShowtimeSeatStatus;
  holdTtlSeconds: number | null;
}
