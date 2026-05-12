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

  getDashboardOverview: async () => {
    // TODO: Uncomment for real implementation
    // const response = await axios.get(`${API_BASE_URL}/admin/overview`);
    // return response.data;

    console.log('📈 [ADMIN] Fetching dashboard overview...');
    const mockOverview = {
      totalRevenue: 248590,
      revenueChange: '+12.4% vs last month',
      occupancyRate: 78,
      seatsSold: 1200,
      seatsAvailable: 420,
    };
    console.log('✅ [ADMIN] Overview fetched:', mockOverview);
    return mockOverview;
  },

  getLiveSales: async () => {
    // TODO: Uncomment for real implementation
    // const response = await axios.get(`${API_BASE_URL}/admin/live-sales`);
    // return response.data;

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
      {
        id: 'sale-3',
        movieTitle: 'Oppenheimer: 70mm',
        screen: 'Screen 02',
        tickets: 1,
        amount: 24,
        posterUrl: 'https://via.placeholder.com/80x80?text=70mm',
      },
    ];
    console.log('✅ [ADMIN] Live sales fetched');
    return mockSales;
  },

  getPopularMovies: async () => {
    // TODO: Uncomment for real implementation
    // const response = await axios.get(`${API_BASE_URL}/admin/popular-movies`);
    // return response.data;

    console.log('🎞️ [ADMIN] Fetching popular movies...');
    const mockPopular = [
      { id: 'movie-1', title: 'Dune: Part Two', score: 92 },
      { id: 'movie-2', title: 'Spider-Man: Across the Spider-Verse', score: 84 },
      { id: 'movie-3', title: 'Poor Things', score: 71 },
      { id: 'movie-4', title: 'Past Lives', score: 65 },
    ];
    console.log('✅ [ADMIN] Popular movies fetched');
    return mockPopular;
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

  getShowtimeSchedules: async () => {
    // TODO: Uncomment for real implementation
    // const response = await axios.get(`${API_BASE_URL}/admin/showtimes`);
    // return response.data;

    console.log('🗓️ [ADMIN] Fetching showtime schedules...');
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
      {
        id: 'show-2',
        movieTitle: 'The Last Architect',
        genre: 'Drama',
        duration: '1h 50m',
        hall: 'Grand Hall A',
        date: 'Oct 24, 2023',
        time: '21:00',
        posterUrl: 'https://via.placeholder.com/120x160?text=Architect',
      },
      {
        id: 'show-3',
        movieTitle: 'Echoes of Silence',
        genre: 'Thriller',
        duration: '2h 05m',
        hall: 'Suite 04 (VIP)',
        date: 'Oct 25, 2023',
        time: '14:15',
        posterUrl: 'https://via.placeholder.com/120x160?text=Echoes',
      },
    ];
    console.log('✅ [ADMIN] Showtime schedules fetched');
    return mockSchedules;
  },

  getTheaters: async () => {
    // TODO: Uncomment for real implementation
    // const response = await axios.get(`${API_BASE_URL}/admin/theaters`);
    // return response.data;

    console.log('🏛️ [ADMIN] Fetching theaters...');
    const mockTheaters = [
      {
        id: 'theater-1',
        name: 'Grand Plaza Cineplex',
        region: 'Downtown District',
        isExpanded: true,
        rooms: [
          {
            id: 'room-1',
            name: 'Screen 01 - Main Hall',
            level: 'Level 1 • East Wing',
            capacity: 450,
            technologies: ['IMAX', 'Laser'],
            status: 'operational',
          },
          {
            id: 'room-2',
            name: 'Screen 02 - Sensory Room',
            level: 'Level 1 • North Wing',
            capacity: 120,
            technologies: ['4DX', 'Dolby Atmos'],
            status: 'operational',
          },
          {
            id: 'room-3',
            name: 'Screen 03 - Boutique',
            level: 'Level 2 • VIP Lounge',
            capacity: 45,
            technologies: ['VIP'],
            status: 'maintenance',
          },
        ],
      },
      {
        id: 'theater-2',
        name: 'Metropolis Hub',
        region: 'Uptown Corridor',
        isExpanded: false,
        rooms: [],
      },
      {
        id: 'theater-3',
        name: 'Starlight Open Air',
        region: 'Park Side',
        isExpanded: false,
        rooms: [],
      },
    ];
    console.log('✅ [ADMIN] Theaters fetched');
    return mockTheaters;
  },

  getPricingOverview: async () => {
    // TODO: Uncomment for real implementation
    // const response = await axios.get(`${API_BASE_URL}/admin/pricing`);
    // return response.data;

    console.log('💳 [ADMIN] Fetching pricing overview...');
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
        {
          id: 'tier-2',
          title: 'VIP Lounge',
          description: 'Multiplier for luxury seating clusters',
          value: '2.5x Base',
          badge: 'VIP LOUNGE',
        },
      ],
    };
    console.log('✅ [ADMIN] Pricing overview fetched');
    return mockPricing;
  },

  getVouchers: async () => {
    // TODO: Uncomment for real implementation
    // const response = await axios.get(`${API_BASE_URL}/admin/vouchers`);
    // return response.data;

    console.log('🎟️ [ADMIN] Fetching vouchers...');
    const mockVouchers = [
      {
        id: 'voucher-1',
        code: 'SUMMER24',
        discount: '20% OFF',
        expiry: 'Aug 31, 2024',
        usageUsed: 325,
        usageLimit: 500,
        status: 'active',
      },
      {
        id: 'voucher-2',
        code: 'WELCOMENEW',
        discount: '$5.00 Flat',
        expiry: 'No Expiry',
        usageUsed: 1200,
        usageLimit: null,
        status: 'active',
      },
      {
        id: 'voucher-3',
        code: 'FLASH15',
        discount: '15% OFF',
        expiry: 'May 15, 2024',
        usageUsed: 200,
        usageLimit: 200,
        status: 'inactive',
      },
      {
        id: 'voucher-4',
        code: 'VIPEXCLUSIVE',
        discount: 'BOGO Free',
        expiry: 'Dec 31, 2024',
        usageUsed: 88,
        usageLimit: 100,
        status: 'active',
      },
    ];
    console.log('✅ [ADMIN] Vouchers fetched');
    return mockVouchers;
  },

  getUserPermissions: async () => {
    // TODO: Uncomment for real implementation
    // const response = await axios.get(`${API_BASE_URL}/admin/permissions/users`);
    // return response.data;

    console.log('🧑‍💼 [ADMIN] Fetching user permissions...');
    const mockUsers = [
      {
        id: 'user-1',
        name: 'Jordan Smith',
        email: 'j.smith@cinemaops.com',
        status: 'active',
        lastActivity: '2 mins ago',
        roles: { customer: true, staff: false, admin: false },
      },
      {
        id: 'user-2',
        name: 'Marcus Aurelius',
        email: 'm.aurelius@cinemaops.com',
        status: 'active',
        lastActivity: '1 hour ago',
        roles: { customer: true, staff: true, admin: false },
      },
      {
        id: 'user-3',
        name: 'Elena Loft',
        email: 'e.loft@cinemaops.com',
        status: 'on-leave',
        lastActivity: '3 days ago',
        roles: { customer: true, staff: true, admin: true },
      },
      {
        id: 'user-4',
        name: 'Kevin Chen',
        email: 'k.chen@cinemaops.com',
        status: 'deactivated',
        lastActivity: 'Never',
        roles: { customer: true, staff: false, admin: false },
      },
    ];
    console.log('✅ [ADMIN] User permissions fetched');
    return mockUsers;
  },

  getPermissionRules: async () => {
    // TODO: Uncomment for real implementation
    // const response = await axios.get(`${API_BASE_URL}/admin/permissions/rules`);
    // return response.data;

    console.log('🧩 [ADMIN] Fetching permission rules...');
    const mockRules = [
      {
        id: 'rule-1',
        title: 'Manage Financial Reports',
        description: 'Allows access to revenue, tax, and payout data.',
        tags: ['Admin Only'],
      },
      {
        id: 'rule-2',
        title: 'Edit Cinema Schedules',
        description: 'Modify screening times and room assignments.',
        tags: ['Staff', 'Admin'],
      },
      {
        id: 'rule-3',
        title: 'Access Global Logs',
        description: 'View detailed system activity and audit trails.',
        tags: ['Admin Only'],
      },
    ];
    console.log('✅ [ADMIN] Permission rules fetched');
    return mockRules;
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
