export type SeatStatus = 'available' | 'selected' | 'sold' | 'holding'; //will be changed to integrate with backend later
export type SeatType = 'normal' | 'vip'; //double to come later

export interface Seat {
  id: string;
  label: string;
  row: string;
  number: number;
  status: SeatStatus;
  type: SeatType;
  price: number;
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
