import apiClient from './authService';
import {
  AdminMovieListItem,
  AdminPermissionRule,
  AdminTheater,
  AdminUserPermission,
  AdminVoucher,
} from '../types/admin';

// Admin Service
export const adminService = {
  // ── Dashboard Stats (Mocked) ────────────────────────────────────────────────
  getDashboardStats: async () => {
    console.log('📊 [ADMIN] Fetching dashboard stats...');
    const mockStats = {
      totalBookings: 1543,
      totalRevenue: 308600000,
      activeUsers: 487,
      totalMovies: 24,
    };
    return mockStats;
  },

  getDashboardOverview: async () => {
    console.log('📈 [ADMIN] Fetching dashboard overview...');
    const mockOverview = {
      totalRevenue: 248590,
      revenueChange: '+12.4% vs last month',
      occupancyRate: 78,
      seatsSold: 1200,
      seatsAvailable: 420,
    };
    return mockOverview;
  },

  getLiveSales: async () => {
    console.log('🧾 [ADMIN] Fetching live sales...');
    const mockSales = [
      {
        id: 'sale-1',
        movieTitle: 'Interstellar: IMAX Re-issue',
        screen: 'Screen 01',
        tickets: 2,
        amount: 48,
        posterUrl: 'https://via.placeholder.com/80x80?text=IMAX',
      },
      {
        id: 'sale-2',
        movieTitle: 'The Grand Budapest Hotel',
        screen: 'Screen 04',
        tickets: 4,
        amount: 72,
        posterUrl: 'https://via.placeholder.com/80x80?text=GBH',
      },
    ];
    return mockSales;
  },

  getPopularMovies: async () => {
    console.log('🎞️ [ADMIN] Fetching popular movies...');
    const mockPopular = [
      { id: 'movie-1', title: 'Dune: Part Two', score: 92 },
      { id: 'movie-2', title: 'Spider-Man: Across the Spider-Verse', score: 84 },
    ];
    return mockPopular;
  },

  // ── Movies (CRUD) ─────────────────────────────────────────────────────────
  getMovieManagement: async (): Promise<AdminMovieListItem[]> => {
    console.log('🎬 [ADMIN] Fetching movies for management...');
    const response = await apiClient.get<{ success: boolean; data: any[] }>('/movies');
    return response.data.data.map(m => ({
      id: m.id,
      title: m.title,
      status: m.active ? 'active' : 'inactive',
      bookings: Math.floor(Math.random() * 500) // Mock booking count since BE doesn't provide it
    }));
  },

  createMovie: async (movieData: any) => {
    console.log('🎬 [ADMIN] Creating movie:', movieData);
    const response = await apiClient.post<{ success: boolean; data: any }>('/movies', movieData);
    return response.data.data;
  },

  updateMovie: async (id: number | string, movieData: any) => {
    console.log(`🎬 [ADMIN] Updating movie ${id}:`, movieData);
    const response = await apiClient.put<{ success: boolean; data: any }>(`/movies/${id}`, movieData);
    return response.data.data;
  },

  deleteMovie: async (id: number | string) => {
    console.log(`🎬 [ADMIN] Deleting movie ${id}...`);
    const response = await apiClient.delete<{ success: boolean; data: any }>(`/movies/${id}`);
    return response.data.data;
  },

  // ── Schedules (Skipped/Mocked) ────────────────────────────────────────────
  getShowtimeSchedules: async () => {
    console.log('🗓️ [ADMIN] Fetching showtime schedules (Mock)...');
    const mockSchedules = [
      {
        id: 'show-1',
        movieTitle: 'Neon Horizon: Part II',
        genre: 'Sci-Fi',
        duration: '2h 15m',
        hall: 'IMAX Theater 01',
        date: 'Oct 24, 2023',
        time: '19:30',
        posterUrl: 'https://via.placeholder.com/120x160?text=Neon',
      },
    ];
    return mockSchedules;
  },

  // ── Theaters (CRUD) ───────────────────────────────────────────────────────
  getTheaters: async (): Promise<AdminTheater[]> => {
    console.log('🏛️ [ADMIN] Fetching theaters...');
    const response = await apiClient.get<{ success: boolean; data: any[] }>('/cinemas');
    const theaters = await Promise.all(response.data.data.map(async (c) => {
       // Fetch rooms for each cinema
       const roomsRes = await apiClient.get<{ success: boolean; data: any[] }>(`/cinemas/${c.id}/rooms`);
       const rooms = roomsRes.data.data.map((r: any) => ({
           id: String(r.id),
           name: r.name,
           level: r.type || 'Standard',
           capacity: r.totalSeats || (r.rows * r.columns),
           technologies: [r.type].filter(Boolean),
           status: (r.underMaintenance ? 'maintenance' : 'operational') as 'maintenance' | 'operational',
           rows: r.rows || 10,
           columns: r.columns || 14,
       }));
       return {
           id: String(c.id),
           name: c.name,
           region: c.city || 'Unknown',
           isExpanded: false,
           rooms: rooms
       };
    }));
    return theaters;
  },

  createTheater: async (theaterData: any) => {
    console.log('🏛️ [ADMIN] Creating theater:', theaterData);
    const response = await apiClient.post<{ success: boolean; data: any }>('/cinemas', theaterData);
    return response.data.data;
  },

  updateTheater: async (id: number | string, theaterData: any) => {
    console.log(`🏛️ [ADMIN] Updating theater ${id}:`, theaterData);
    const response = await apiClient.put<{ success: boolean; data: any }>(`/cinemas/${id}`, theaterData);
    return response.data.data;
  },

  deleteTheater: async (id: number | string) => {
    console.log(`🏛️ [ADMIN] Deleting theater ${id}...`);
    const response = await apiClient.delete<{ success: boolean; data: any }>(`/cinemas/${id}`);
    return response.data.data;
  },

  createRoom: async (cinemaId: number | string, roomData: any) => {
    console.log(`🏛️ [ADMIN] Creating room for cinema ${cinemaId}:`, roomData);
    const response = await apiClient.post<{ success: boolean; data: any }>(`/cinemas/${cinemaId}/rooms`, roomData);
    return response.data.data;
  },

  deleteRoom: async (cinemaId: number | string, roomId: number | string) => {
    console.log(`🏛️ [ADMIN] Deleting room ${roomId} in cinema ${cinemaId}...`);
    const response = await apiClient.delete<{ success: boolean; data: any }>(`/cinemas/${cinemaId}/rooms/${roomId}`);
    return response.data.data;
  },

  getRoomSeatMap: async (cinemaId: number | string, roomId: number | string) => {
    console.log(`💺 [ADMIN] Fetching seat map for room ${roomId}...`);
    const response = await apiClient.get<{ success: boolean; data: any[] }>(`/cinemas/${cinemaId}/rooms/${roomId}/seats`);
    return response.data.data;
  },

  updateRoomSeatMap: async (cinemaId: number | string, roomId: number | string, data: any) => {
    console.log(`💺 [ADMIN] Updating seat map for room ${roomId}...`, data);
    const response = await apiClient.put<{ success: boolean; data: any }>(`/cinemas/${cinemaId}/rooms/${roomId}/seats`, data);
    return response.data.data;
  },

  // ── Pricing (Skipped/Mocked) ──────────────────────────────────────────────
  getPricingOverview: async () => {
    console.log('💳 [ADMIN] Fetching pricing overview (Mock)...');
    const mockPricing = {
      baseRate: 14.5,
      tiers: [
        {
          id: 'tier-1',
          title: 'Weekend Premium',
          description: 'Applied Fri 6PM to Sun 11PM',
          value: '+ $3.50',
          badge: 'WEEKEND PREMIUM',
        },
      ],
    };
    return mockPricing;
  },

  // ── Vouchers (CRUD with Mocked PUT/DELETE) ────────────────────────────────
  getVouchers: async (): Promise<AdminVoucher[]> => {
    console.log('🎟️ [ADMIN] Fetching vouchers...');
    // Backend returns raw list (no ApiResponse wrapper)
    const response = await apiClient.get<any[]>('/vouchers');
    return response.data.map(v => ({
      id: String(v.id),
      code: v.code,
      discount: v.discountType === 'PERCENTAGE' ? `${v.discountValue}% OFF` : `$${v.discountValue} Flat`,
      expiry: new Date(v.validUntil).toLocaleDateString(),
      usageUsed: v.usedCount || 0,
      usageLimit: v.usageLimit || null,
      status: v.active ? 'active' : 'inactive',
    }));
  },

  createVoucher: async (voucherData: any) => {
    console.log('🎟️ [ADMIN] Creating voucher:', voucherData);
    const response = await apiClient.post<any>('/vouchers', voucherData);
    return response.data;
  },

  updateVoucher: async (id: string | number, voucherData: any) => {
    console.log(`🎟️ [ADMIN] Mock updating voucher ${id}...`, voucherData);
    // Missing in backend; mock for now
    return { id, ...voucherData, status: 'active' };
  },

  deleteVoucher: async (id: string | number) => {
    console.log(`🎟️ [ADMIN] Mock deleting voucher ${id}...`);
    // Missing in backend; mock for now
    return { success: true };
  },

  // ── User Management & Permissions (CRUD with Mocked PUT/DELETE) ──────────
  getUserManagement: async () => {
    console.log('👥 [ADMIN] Fetching users for management...');
    const response = await apiClient.get<{ success: boolean; data: any[] }>('/users');
    return response.data.data.map(u => ({
      id: u.id,
      email: u.email,
      role: u.roles && u.roles.length > 0 ? u.roles[0].replace('ROLE_', '') : 'USER',
      bookings: Math.floor(Math.random() * 10) // Mock booking count
    }));
  },

  getUserPermissions: async (): Promise<AdminUserPermission[]> => {
    console.log('🧑‍💼 [ADMIN] Fetching user permissions...');
    const response = await apiClient.get<{ success: boolean; data: any[] }>('/users');
    return response.data.data.map(u => ({
      id: String(u.id),
      name: u.fullName || u.email.split('@')[0],
      email: u.email,
      status: 'active', // Backend doesn't track user active status currently
      lastActivity: 'Unknown',
      roles: {
         customer: u.roles?.includes('ROLE_CUSTOMER') || false,
         staff: u.roles?.includes('ROLE_STAFF') || false,
         admin: u.roles?.includes('ROLE_ADMIN') || false
      }
    }));
  },

  updateUser: async (id: string | number, userData: any) => {
    console.log(`🧑‍💼 [ADMIN] Mock updating user ${id}...`, userData);
    // Missing in backend; mock for now
    return { id, ...userData };
  },

  deleteUser: async (id: string | number) => {
    console.log(`🧑‍💼 [ADMIN] Mock deleting user ${id}...`);
    // Missing in backend; mock for now
    return { success: true };
  },

  getPermissionRules: async (): Promise<AdminPermissionRule[]> => {
    console.log('🧩 [ADMIN] Fetching permission rules (Mock)...');
    const mockRules: AdminPermissionRule[] = [
      {
        id: 'rule-1',
        title: 'Manage Financial Reports',
        description: 'Allows access to revenue, tax, and payout data.',
        tags: ['Admin Only'],
      },
    ];
    return mockRules;
  },
};
