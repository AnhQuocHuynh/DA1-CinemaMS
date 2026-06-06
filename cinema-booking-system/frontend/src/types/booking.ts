// Booking flow frontend types — kept in sync with the backend API contract

export type SeatStatus = 'available' | 'selected' | 'sold' | 'holding';
export type SeatType = 'normal' | 'vip' | 'couple';

/** UI-layer seat model (converted from ShowtimeSeatResponse) */
export interface Seat {
  id: string;          // stringified ShowtimeSeat.id (PK used for API calls)
  numericId: number;   // raw numeric id for API payloads
  label: string;
  row: string;
  number: number;
  status: SeatStatus;
  type: SeatType;
  price: number;       // in VND (parsed from decimal string)
  isPathway?: boolean;
}

export interface SeatRow {
  rowLabel: string;
  seats: Seat[];
}

export interface SeatMap {
  rows: SeatRow[];
}

export interface BookingSummary {
  movieTitle: string;
  cinemaName: string;
  hallName: string;
  showtime: string;    // formatted date/time string
  seats: Seat[];
  subtotal: number;    // VND
  discount: number;    // VND — from voucher
  total: number;       // VND
  voucherCode: string | null;
}

// ── Backend raw types (used in service layer) ──────────────────────────────

export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';

export interface BackendTicket {
  id: number;
  showtimeSeatId: number;
  ticketCode: string;
  qrCodeData: string;   // base64 PNG
  price: string;
  status: 'VALID' | 'USED' | 'CANCELLED' | 'CHECKED_IN';
  checkedInAt: string | null;
  createdAt: string;
}

export interface BackendOrder {
  id: number;
  userId: number;
  showtimeId: number;
  seatIdsSnapshot: string;
  voucherId: number | null;
  totalAmount: string;
  discountAmount: string;
  finalAmount: string;
  status: OrderStatus;
  paymentMethod: string | null;
  paymentTransactionId: string | null;
  tickets: BackendTicket[];
  createdAt: string;
  updatedAt: string;
}

export interface BackendVoucher {
  id: number;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: string;
  maxDiscountAmount: string | null;
  usageLimit: number;
  usedCount: number;
  validFrom: string;
  validUntil: string;
  active: boolean;
}

/** Frontend ticket details model (shown in TicketInfo page) */
export interface TicketDetails {
  ticketCode: string;
  orderId: number;
  movieTitle: string;
  cinemaName: string;
  hallName: string;
  showtime: string;
  date: string;
  time: string;
  seats: string[];            // seat labels e.g. ["A3", "A4"]
  qrCodeData: string;         // base64 PNG (render as data: URI)
  price: number;              // VND per ticket
  status: string;
  posterUrl: string;          // may be empty string if not available
}
