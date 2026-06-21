import { StaffBookingValidation, StaffScanResult } from '../types/staff';

// Staff Service
export const staffService = {
  getStaffDashboard: async () => {
    console.log('👔 [STAFF] Fetching staff dashboard...');
    const mockData = {
      todayBookings: 47,
      totalTicketsSold: 98,
      peakHour: '7:30 PM',
    };
    console.log('✅ [STAFF] Dashboard data fetched:', mockData);
    return mockData;
  },

  getBookingsList: async () => {
    console.log('📋 [STAFF] Fetching bookings list...');
    const mockBookings = [
      { id: 'booking-1', customer: 'John Doe', movieTitle: 'Interstellar', time: '10:00 AM', seats: 2 },
      { id: 'booking-2', customer: 'Jane Smith', movieTitle: 'Inception', time: '1:30 PM', seats: 3 },
    ];
    console.log('✅ [STAFF] Bookings list fetched:', mockBookings);
    return mockBookings;
  },

  getValidationStats: async () => {
    // TODO: Uncomment for real implementation
    // const response = await axios.get(`${API_BASE_URL}/staff/validation/stats`);
    // return response.data;

    console.log('✅ [STAFF] Fetching validation stats...');
    return {
      totalValidated: 1284,
      pendingCheckIns: 452,
      totalBookings: 1736,
      validatorsOnline: 14,
    };
  },

  getValidationBookings: async (): Promise<StaffBookingValidation[]> => {
    // TODO: Uncomment for real implementation
    // const response = await axios.get(`${API_BASE_URL}/staff/validation/bookings`);
    // return response.data;

    console.log('✅ [STAFF] Fetching validation bookings...');
    const mockBookings: StaffBookingValidation[] = [
      {
        id: '#BK-90210',
        customerName: 'Adrian Miller',
        movieTitle: 'Oppenheimer: 70mm',
        showtime: 'Today, 19:45',
        status: 'pending',
      },
      {
        id: '#BK-90441',
        customerName: 'Sarah Higgins',
        movieTitle: 'Killers of the Flower Moon',
        showtime: 'Today, 20:15',
        status: 'validated',
      },
    ];
    return mockBookings;
  },

  scanTicket: async (ticketCode: string): Promise<StaffScanResult> => {
    // TODO: Uncomment for real implementation
    // const response = await axios.post(`${API_BASE_URL}/staff/scan`, { ticketCode });
    // return response.data;

    console.log('📷 [STAFF] Scanning ticket:', ticketCode);
    const scanResult: StaffScanResult = {
      status: 'valid',
      seatLabel: 'Row H, Seat 12',
      ticketType: 'Premium',
    };
    return scanResult;
  },

  lookupTicket: async (query: string): Promise<StaffBookingValidation> => {
    // TODO: Uncomment for real implementation
    // const response = await axios.get(`${API_BASE_URL}/staff/tickets?query=${query}`);
    // return response.data;

    console.log('🔎 [STAFF] Looking up ticket:', query);
    const mockTicket: StaffBookingValidation = {
      id: '#BK-90210',
      customerName: 'Adrian Miller',
      movieTitle: 'Oppenheimer: 70mm',
      showtime: 'Today, 19:45',
      status: 'pending',
    };
    return mockTicket;
  },
};
