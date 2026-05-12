import { useEffect, useState } from 'react';
import { adminService } from '../services/adminService';
import { AdminDashboardOverview, AdminLiveSale, AdminPopularMovie } from '../types/admin';

export const useAdminDashboard = () => {
  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null);
  const [liveSales, setLiveSales] = useState<AdminLiveSale[]>([]);
  const [popularMovies, setPopularMovies] = useState<AdminPopularMovie[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [overviewData, liveSalesData, popularMoviesData] = await Promise.all([
          adminService.getDashboardOverview(),
          adminService.getLiveSales(),
          adminService.getPopularMovies(),
        ]);
        setOverview(overviewData);
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

  return { overview, liveSales, popularMovies, isLoading };
};
