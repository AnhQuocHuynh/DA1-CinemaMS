import { useEffect, useState } from 'react';
import { adminService } from '../services/adminService';
import { AdminMovieListItem } from '../types/admin';

export const useAdminMovies = () => {
  const [movies, setMovies] = useState<AdminMovieListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMovies = async () => {
      try {
        const data = await adminService.getMovieManagement();
        setMovies(data);
      } catch (error) {
        console.error('Failed to load movie management data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMovies();
  }, []);

  return { movies, isLoading };
};
