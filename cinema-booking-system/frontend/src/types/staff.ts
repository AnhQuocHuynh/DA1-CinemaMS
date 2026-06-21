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
