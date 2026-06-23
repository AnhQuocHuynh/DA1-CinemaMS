import { useEffect, useState } from 'react';
import { adminService } from '../services/adminService';
import { AdminDashboardOverview, AdminLiveSale, AdminPopularMovie, AdminRevenuePoint } from '../types/admin';

export const useAdminDashboard = () => {
  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null);
  const [revenueSeries, setRevenueSeries] = useState<AdminRevenuePoint[]>([]);
  const [liveSales, setLiveSales] = useState<AdminLiveSale[]>([]);
  const [popularMovies, setPopularMovies] = useState<AdminPopularMovie[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [overviewData, revenueSeriesData, liveSalesData, popularMoviesData] = await Promise.all([
          adminService.getDashboardOverview(),
          adminService.getRevenueSeries(),
          adminService.getLiveSales(),
          adminService.getPopularMovies(),
        ]);
        setOverview(overviewData);
        setRevenueSeries(revenueSeriesData);
        setLiveSales(liveSalesData);
        setPopularMovies(popularMoviesData);
      } catch (error) {
        console.error('Failed to load admin dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  return { overview, revenueSeries, liveSales, popularMovies, isLoading };
};
