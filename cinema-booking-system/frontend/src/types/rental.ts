export type RentalStatus =
  | 'PENDING_APPROVAL'
  | 'AWAITING_PAYMENT'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED';

export type RefundStatus = 'NONE' | 'PENDING' | 'COMPLETED';

export type RentalUnavailableCode =
  | 'ROOM_UNAVAILABLE'
  | 'MOVIE_DOES_NOT_FIT'
  | 'SHOWTIME_OVERLAP'
  | 'ROOM_SLOT_TAKEN'
  | 'ROOM_RATE_MISSING';

export interface RentalWindowRequest {
  roomId: number;
  movieId?: number | null;
  startTime: string;
  endTime: string;
}

export interface RentalCreateRequest extends RentalWindowRequest {
  userId?: number;
}

export interface RentalQuote {
  roomId: number;
  cinemaId: number | null;
  roomName: string | null;
  startTime: string | null;
  endTime: string | null;
  pricePerHour: number | null;
  billedHours: number;
  totalAmount: number | null;
  available: boolean;
  unavailableCode: RentalUnavailableCode | string | null;
}

export interface RentalView {
  id: number;
  userId: number;
  cinemaId: number;
  roomId: number;
  movieId: number | null;
  startTime: string;
  endTime: string;
  pricePerHour: number;
  totalAmount: number;
  status: RentalStatus;
  paymentMethod: string | null;
  decisionReason: string | null;
  expiresAt: string | null;
  refundAmount: number | null;
  refundStatus: RefundStatus;
}

export interface BusySlot {
  source: 'RENTAL' | 'SHOWTIME';
  startTime: string;
  endTime: string;
  status: string;
}

export interface RoomAvailability {
  roomId: number;
  from: string;
  to: string;
  pricePerHour: number;
  busy: BusySlot[];
}

export interface RentalBucket {
  key: string;
  count: number;
  confirmedRevenue: number;
}

export interface RentalReport {
  rentalCount: number;
  confirmedRevenue: number;
  byRoom: RentalBucket[];
  byDay: RentalBucket[];
}

export interface RentalSearchParams {
  cinemaId?: number;
  roomId?: number;
  status?: RentalStatus;
  from?: string;
  to?: string;
  userId?: number;
}

