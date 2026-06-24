export interface StaffDashboardSummary {
  todayBookings: number;
  totalTicketsSold: number;
  peakHour: string;
}

export interface StaffBookingListItem {
  id: string;
  customer: string;
  customerName: string;
  movieTitle: string;
  time: string;
  showtime: string;
  seats: number;
  status: 'confirmed' | 'pending' | 'validated';
}

export interface StaffValidationStats {
  totalValidated: number;
  pendingCheckIns: number;
  totalBookings: number;
  validatorsOnline: number;
}

export interface StaffBookingValidation {
  id: string;
  customerName: string;
  movieTitle: string;
  showtime: string;
  status: 'pending' | 'validated';
}

export interface StaffScanResult {
  status: 'valid' | 'invalid' | 'duplicate';
  seatLabel: string;
  ticketType: string;
}

export interface StaffCounterBookingRequest {
  showtimeId: number;
  seatIds: number[];
  customerName?: string;
  customerPhone?: string;
  paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER';
  voucherCode?: string | null;
}

export interface StaffCounterBookingResult {
  id: number;
  userId: number;
  showtimeId: number;
  movieId?: number | null;
  movieTitle?: string | null;
  eventId?: number | null;
  eventTitle?: string | null;
  displayTitle?: string | null;
  displayType?: string | null;
  cinemaName?: string | null;
  roomName?: string | null;
  startTime?: string | null;
  seatLabels?: string[];
  totalAmount: string;
  discountAmount: string;
  finalAmount: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';
  salesChannel?: 'ONLINE' | 'COUNTER';
  customerName?: string | null;
  customerPhone?: string | null;
  paymentMethod?: string | null;
  tickets?: Array<{
    id: number;
    ticketCode: string;
    seatLabel?: string;
    price: string;
    status: string;
  }>;
}
