import apiClient from './authService';
import {
  AdminDashboardOverview,
  AdminLiveSale,
  AdminMovieListItem,
  AdminPermissionRule,
  AdminPopularMovie,
  AdminRevenuePoint,
  AdminTheater,
  AdminUserPermission,
  AdminVoucher,
} from '../types/admin';

// Admin Service
export const adminService = {
  // Dashboard Stats
  getDashboardStats: async () => {
    console.log('[ADMIN] Fetching dashboard stats...');
    const overview = await adminService.getDashboardOverview();
    return {
      totalBookings: overview.totalBookings || 0,
      totalRevenue: overview.totalRevenue,
      activeUsers: overview.activeUsers || 0,
      totalMovies: overview.totalMovies || 0,
    };
  },

  getDashboardOverview: async (): Promise<AdminDashboardOverview> => {
    console.log('[ADMIN] Fetching dashboard overview...');
    const response = await apiClient.get<{ success: boolean; data: AdminDashboardOverview }>('/admin/dashboard/overview');
    const data = response.data.data;
    return {
      ...data,
      totalRevenue: Number(data.totalRevenue || 0),
      occupancyRate: Number(data.occupancyRate || 0),
      seatsSold: Number(data.seatsSold || 0),
      seatsAvailable: Number(data.seatsAvailable || 0),
      totalBookings: Number(data.totalBookings || 0),
      activeUsers: Number(data.activeUsers || 0),
      totalMovies: Number(data.totalMovies || 0),
    };
  },

  getRevenueSeries: async (): Promise<AdminRevenuePoint[]> => {
    console.log('[ADMIN] Fetching revenue series...');
    const response = await apiClient.get<{ success: boolean; data: AdminRevenuePoint[] }>('/admin/dashboard/revenue-series');
    return response.data.data.map((point) => ({
      ...point,
      revenue: Number(point.revenue || 0),
      orders: Number(point.orders || 0),
      tickets: Number(point.tickets || 0),
    }));
  },

  getLiveSales: async (): Promise<AdminLiveSale[]> => {
    console.log('[ADMIN] Fetching live sales...');
    const response = await apiClient.get<{ success: boolean; data: AdminLiveSale[] }>('/admin/dashboard/live-sales?limit=5');
    return response.data.data.map((sale) => ({
      ...sale,
      tickets: Number(sale.tickets || 0),
      amount: Number(sale.amount || 0),
    }));
  },

  getPopularMovies: async (): Promise<AdminPopularMovie[]> => {
    console.log('[ADMIN] Fetching popular movies...');
    const response = await apiClient.get<{ success: boolean; data: AdminPopularMovie[] }>('/admin/dashboard/popular-movies?limit=5');
    return response.data.data.map((movie) => ({
      ...movie,
      score: Number(movie.score || 0),
      ticketsSold: Number(movie.ticketsSold || 0),
      revenue: Number(movie.revenue || 0),
    }));
  },
  // â”€â”€ Movies (CRUD) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  getMovieManagement: async (): Promise<AdminMovieListItem[]> => {
    console.log('ðŸŽ¬ [ADMIN] Fetching movies for management...');
    const response = await apiClient.get<{ success: boolean; data: any[] }>('/movies');
    return response.data.data.map(m => ({
      id: m.id,
      title: m.title,
      status: m.active ? 'active' : 'inactive',
      bookings: Math.floor(Math.random() * 500) // Mock booking count since BE doesn't provide it
    }));
  },

  createMovie: async (movieData: any) => {
    console.log('ðŸŽ¬ [ADMIN] Creating movie:', movieData);
    const response = await apiClient.post<{ success: boolean; data: any }>('/movies', movieData);
    return response.data.data;
  },

  updateMovie: async (id: number | string, movieData: any) => {
    console.log(`ðŸŽ¬ [ADMIN] Updating movie ${id}:`, movieData);
    const response = await apiClient.put<{ success: boolean; data: any }>(`/movies/${id}`, movieData);
    return response.data.data;
  },

  deleteMovie: async (id: number | string) => {
    console.log(`ðŸŽ¬ [ADMIN] Deleting movie ${id}...`);
    const response = await apiClient.delete<{ success: boolean; data: any }>(`/movies/${id}`);
    return response.data.data;
  },

  // â”€â”€ Schedules (Skipped/Mocked) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  getShowtimeSchedules: async () => {
    console.log('ðŸ—“ï¸ [ADMIN] Fetching showtime schedules (Mock)...');
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

  // â”€â”€ Theaters (CRUD) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  getTheaters: async (): Promise<AdminTheater[]> => {
    console.log('ðŸ›ï¸ [ADMIN] Fetching theaters...');
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
    console.log('ðŸ›ï¸ [ADMIN] Creating theater:', theaterData);
    const response = await apiClient.post<{ success: boolean; data: any }>('/cinemas', theaterData);
    return response.data.data;
  },

  updateTheater: async (id: number | string, theaterData: any) => {
    console.log(`ðŸ›ï¸ [ADMIN] Updating theater ${id}:`, theaterData);
    const response = await apiClient.put<{ success: boolean; data: any }>(`/cinemas/${id}`, theaterData);
    return response.data.data;
  },

  deleteTheater: async (id: number | string) => {
    console.log(`ðŸ›ï¸ [ADMIN] Deleting theater ${id}...`);
    const response = await apiClient.delete<{ success: boolean; data: any }>(`/cinemas/${id}`);
    return response.data.data;
  },

  createRoom: async (cinemaId: number | string, roomData: any) => {
    console.log(`ðŸ›ï¸ [ADMIN] Creating room for cinema ${cinemaId}:`, roomData);
    const response = await apiClient.post<{ success: boolean; data: any }>(`/cinemas/${cinemaId}/rooms`, roomData);
    return response.data.data;
  },

  deleteRoom: async (cinemaId: number | string, roomId: number | string) => {
    console.log(`ðŸ›ï¸ [ADMIN] Deleting room ${roomId} in cinema ${cinemaId}...`);
    const response = await apiClient.delete<{ success: boolean; data: any }>(`/cinemas/${cinemaId}/rooms/${roomId}`);
    return response.data.data;
  },

  getRoomSeatMap: async (cinemaId: number | string, roomId: number | string) => {
    console.log(`ðŸ’º [ADMIN] Fetching seat map for room ${roomId}...`);
    const response = await apiClient.get<{ success: boolean; data: any[] }>(`/cinemas/${cinemaId}/rooms/${roomId}/seats`);
    return response.data.data;
  },

  updateRoomSeatMap: async (cinemaId: number | string, roomId: number | string, data: any) => {
    console.log(`ðŸ’º [ADMIN] Updating seat map for room ${roomId}...`, data);
    const response = await apiClient.put<{ success: boolean; data: any }>(`/cinemas/${cinemaId}/rooms/${roomId}/seats`, data);
    return response.data.data;
  },

  // â”€â”€ Pricing (Skipped/Mocked) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  getPricingOverview: async () => {
    console.log('ðŸ’³ [ADMIN] Fetching pricing overview (Mock)...');
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

  // ————————————————————————————————————————————————————————————————————————————————————————
  getVouchers: async (): Promise<AdminVoucher[]> => {
    console.log('🎟️ [ADMIN] Fetching vouchers...');
    // Backend returns raw list (no ApiResponse wrapper)
    const response = await apiClient.get<any[]>('/vouchers');
    return response.data.map(v => ({
      id: String(v.id),
      code: v.code,
      discount: v.discountType === 'PERCENTAGE' ? `${v.discountValue}% OFF` : `$${v.discountValue} Flat`,
      expiry: v.validUntil ? new Date(v.validUntil).toLocaleDateString() : 'No Expiry',
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
    console.log(`🎟️ [ADMIN] Deleting voucher ${id}...`);
    const response = await apiClient.delete<any>(`/vouchers/${id}`);
    return response.data;
  },

  // ————————————————————————————————————————————————————————————————————————————————————————
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
    console.log('ðŸ§‘â€ðŸ’¼ [ADMIN] Fetching user permissions...');
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
    console.log(`ðŸ§‘â€ðŸ’¼ [ADMIN] Mock updating user ${id}...`, userData);
    // Missing in backend; mock for now
    return { id, ...userData };
  },

  deleteUser: async (id: string | number) => {
    console.log(`ðŸ§‘â€ðŸ’¼ [ADMIN] Mock deleting user ${id}...`);
    // Missing in backend; mock for now
    return { success: true };
  },

  getPermissionRules: async (): Promise<AdminPermissionRule[]> => {
    console.log('ðŸ§© [ADMIN] Fetching permission rules (Mock)...');
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


