export type SeatStatus = 'available' | 'selected' | 'sold' | 'holding';

export interface Seat {
  id: string;
  label: string;
  row: string;
  number: number;
  status: SeatStatus;
  price: number;
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
  venue: string;
  showtime: string;
  seats: Seat[];
  fees: number;
  subtotal: number;
  total: number;
}

export interface TicketDetails {
  id: string;
  movieTitle: string;
  director: string;
  hall: string;
  venue: string;
  date: string;
  time: string;
  seats: string[];
  qrCodeUrl: string;
  posterUrl: string;
  status: 'confirmed' | 'cancelled';
}
