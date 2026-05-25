// Booking Service
export const bookingService = {
  createBooking: async (bookingData: any) => {
    // TODO: Uncomment for real implementation
    // const token = localStorage.getItem('authToken');
    // const response = await axios.post(`${API_BASE_URL}/orders`, bookingData, {
    //   headers: { Authorization: `Bearer ${token}` }
    // });
    // return response.data;

    console.log('🎫 [BOOKING] Creating booking:', bookingData);
    const mockBooking = {
      id: 'booking-' + Math.random().toString(36).substr(2, 9),
      status: 'confirmed',
      totalPrice: bookingData.totalPrice || 400000,
      seats: bookingData.seats || ['A1', 'A2'],
      createdAt: new Date(),
    };
    console.log('✅ [BOOKING] Booking created:', mockBooking);
    return mockBooking;
  },

  getSeatMap: async (showtimeId: string) => {
    // TODO: Uncomment for real implementation
    // const response = await axios.get(`${API_BASE_URL}/showtimes/${showtimeId}/seats`);
    // return response.data;

    console.log('🎟️ [BOOKING] Fetching seat map for showtime:', showtimeId);
    const totalSeats = 14;
    const pathwayIndexes = new Set([2, totalSeats - 3]);
    const vipRows = new Set(['G', 'H']);
    const mockSeatMap = {
      rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((row) => ({
        rowLabel: row,
        seats: Array.from({ length: totalSeats }).map((_, index) => {
          const isPathway = pathwayIndexes.has(index);
          const isVip = vipRows.has(row);
          const seatType = isVip ? 'vip' : 'normal';

          return {
            id: `${row}${index + 1}`,
            label: isPathway ? '' : `${row}${index + 1}`,
            row,
            number: index + 1,
            status:
              row === 'A' || (row === 'B' && index < 3)
                ? 'sold'
                : row === 'E' && (index === 6 || index === 7)
                  ? 'holding'
                  : 'available',
            type: seatType,
            price: isVip ? 30 : 24,
            isPathway,
          };
        }),
      })),
    };
    console.log('✅ [BOOKING] Seat map fetched');
    return mockSeatMap;
  },

  getCheckoutSummary: async () => {
    // TODO: Uncomment for real implementation
    // TODO: Backend does not expose a checkout summary endpoint yet.
    // const response = await axios.get(`${API_BASE_URL}/orders/checkout`);
    // return response.data;

    console.log('🧾 [BOOKING] Fetching checkout summary');
    const mockSummary = {
      movieTitle: 'Oppenheimer',
      venue: 'Grand Architecture IMAX, Hall 4',
      showtime: 'Oct 24, 2023 | 07:30 PM',
      seats: ['K12', 'K13', 'K14'],
      subtotal: 54,
      fees: 4.5,
      total: 58.5,
    };
    console.log('✅ [BOOKING] Checkout summary fetched');
    return mockSummary;
  },

  getTicketById: async (ticketId: string) => {
    // TODO: Uncomment for real implementation
    // const response = await axios.get(`${API_BASE_URL}/tickets/code/${ticketId}`);
    // return response.data;

    console.log('🎫 [BOOKING] Fetching ticket:', ticketId);
    const mockTicket = {
      id: ticketId,
      movieTitle: 'Interstellar',
      director: 'Christopher Nolan',
      hall: 'IMAX-04',
      venue: 'The Grand Architectural Cinema, NYC',
      date: 'Friday, Oct 24',
      time: '08:30 PM',
      seats: ['H-12', 'H-13'],
      qrCodeUrl: 'https://via.placeholder.com/160x160?text=QR',
      posterUrl: 'https://via.placeholder.com/400x600?text=Interstellar',
      status: 'confirmed',
    };
    console.log('✅ [BOOKING] Ticket fetched');
    return mockTicket;
  },

  getUserBookings: async () => {
    console.log('🎫 [BOOKING] Fetching user bookings...');
    const mockBookings = [
      { id: 'booking-1', movieTitle: 'Interstellar', date: '2024-05-20', status: 'confirmed', seats: ['A1', 'A2'] },
      { id: 'booking-2', movieTitle: 'The Dark Knight', date: '2024-05-25', status: 'confirmed', seats: ['B3'] },
    ];
    console.log('✅ [BOOKING] Bookings fetched:', mockBookings);
    return mockBookings;
  },
};
