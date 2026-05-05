import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

// Movie Service
export const movieService = {
  getMovies: async () => {
    // TODO: Uncomment for real implementation
    // const response = await axios.get(`${API_BASE_URL}/movies`);
    // return response.data;

    console.log('🎬 [MOVIE] Fetching movies...');
    const mockMovies = [
      { id: 1, title: 'Interstellar', genre: 'Sci-Fi', rating: 8.6, poster: 'https://via.placeholder.com/300x400?text=Interstellar' },
      { id: 2, title: 'The Dark Knight', genre: 'Action', rating: 9.0, poster: 'https://via.placeholder.com/300x400?text=Dark+Knight' },
      { id: 3, title: 'Inception', genre: 'Sci-Fi', rating: 8.8, poster: 'https://via.placeholder.com/300x400?text=Inception' },
    ];
    console.log('✅ [MOVIE] Movies fetched:', mockMovies);
    return mockMovies;
  },

  getMovieById: async (id: number) => {
    console.log('🎬 [MOVIE] Fetching movie:', id);
    const mockMovie = {
      id,
      title: 'Sample Movie',
      genre: 'Action',
      rating: 8.5,
      description: 'A thrilling movie experience',
      poster: 'https://via.placeholder.com/300x400?text=Movie',
      runtime: 148,
    };
    console.log('✅ [MOVIE] Movie fetched:', mockMovie);
    return mockMovie;
  },
};

// Showtimes Service
export const showtimeService = {
  getShowtimes: async (movieId: number) => {
    // TODO: Uncomment for real implementation
    // const response = await axios.get(`${API_BASE_URL}/showtimes?movieId=${movieId}`);
    // return response.data;

    console.log('🕐 [SHOWTIME] Fetching showtimes for movie:', movieId);
    const mockShowtimes = [
      { id: 1, time: '10:00 AM', format: '2D', price: 200000 },
      { id: 2, time: '1:30 PM', format: 'IMAX', price: 300000 },
      { id: 3, time: '5:00 PM', format: '2D', price: 200000 },
      { id: 4, time: '8:30 PM', format: 'IMAX', price: 300000 },
    ];
    console.log('✅ [SHOWTIME] Showtimes fetched:', mockShowtimes);
    return mockShowtimes;
  },
};

// Booking Service
export const bookingService = {
  createBooking: async (bookingData: any) => {
    // TODO: Uncomment for real implementation
    // const token = localStorage.getItem('authToken');
    // const response = await axios.post(`${API_BASE_URL}/bookings`, bookingData, {
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

// Admin Service
export const adminService = {
  getDashboardStats: async () => {
    console.log('📊 [ADMIN] Fetching dashboard stats...');
    const mockStats = {
      totalBookings: 1543,
      totalRevenue: 308600000,
      activeUsers: 487,
      totalMovies: 24,
    };
    console.log('✅ [ADMIN] Stats fetched:', mockStats);
    return mockStats;
  },

  getMovieManagement: async () => {
    console.log('🎬 [ADMIN] Fetching movies for management...');
    const mockMovies = [
      { id: 1, title: 'Interstellar', status: 'active', bookings: 345 },
      { id: 2, title: 'The Dark Knight', status: 'active', bookings: 298 },
      { id: 3, title: 'Inception', status: 'inactive', bookings: 156 },
    ];
    console.log('✅ [ADMIN] Movies fetched:', mockMovies);
    return mockMovies;
  },

  createMovie: async (movieData: any) => {
    console.log('🎬 [ADMIN] Creating movie:', movieData);
    const mockMovie = { id: Math.random(), ...movieData, status: 'active' };
    console.log('✅ [ADMIN] Movie created:', mockMovie);
    return mockMovie;
  },

  getUserManagement: async () => {
    console.log('👥 [ADMIN] Fetching users for management...');
    const mockUsers = [
      { id: 1, email: 'user1@example.com', role: 'USER', bookings: 5 },
      { id: 2, email: 'user2@example.com', role: 'USER', bookings: 3 },
    ];
    console.log('✅ [ADMIN] Users fetched:', mockUsers);
    return mockUsers;
  },
};

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
};
