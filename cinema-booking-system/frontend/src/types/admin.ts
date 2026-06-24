export interface AdminDashboardOverview {
  totalRevenue: number;
  revenueChange: string;
  occupancyRate: number;
  seatsSold: number;
  seatsAvailable: number;
  totalBookings?: number;
  activeUsers?: number;
  totalMovies?: number;
}

export interface AdminRevenuePoint {
  label: string;
  revenue: number;
  orders: number;
  tickets: number;
}

export interface AdminLiveSale {
  id: string;
  movieTitle: string;
  screen: string;
  tickets: number;
  amount: number;
  posterUrl?: string;
}

export interface AdminPopularMovie {
  id: string;
  title: string;
  score: number;
  ticketsSold?: number;
  revenue?: number;
}

export interface AdminMovieListItem {
  id: number;
  title: string;
  status: 'active' | 'inactive' | 'draft';
  bookings: number;
  rating?: number;
}

export interface AdminShowtimeItem {
  id: string;
  movieTitle: string;
  genre: string;
  duration: string;
  hall: string;
  date: string;
  time: string;
  posterUrl: string;
}

export interface AdminRoom {
  id: string;
  name: string;
  level: string;
  capacity: number;
  technologies: string[];
  status: 'operational' | 'maintenance';
  rows: number;
  columns: number;
}

export interface AdminTheater {
  id: string;
  name: string;
  region: string;
  rooms: AdminRoom[];
  isExpanded?: boolean;
}

export interface AdminVoucher {
  id: string;
  code: string;
  discount: string;
  expiry: string;
  usageUsed: number;
  usageLimit: number | null;
  status: 'active' | 'inactive';
}

export interface AdminUserPermission {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'on-leave' | 'deactivated';
  lastActivity: string;
  roles: {
    customer: boolean;
    staff: boolean;
    admin: boolean;
  };
}

export interface AdminPermissionRule {
  id: string;
  title: string;
  description: string;
  tags: string[];
}
