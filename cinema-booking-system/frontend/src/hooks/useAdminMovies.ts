import { useEffect, useState } from 'react';
import { adminService } from '../services/adminService';
import { AdminMovieListItem } from '../types/admin';

export const useAdminMovies = () => {
  const [movies, setMovies] = useState<AdminMovieListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);

  const loadMovies = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getMovieManagement();
      setMovies(data);
    } catch (error) {
      console.error('Failed to load movie management data:', error);
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  };

  const retry = () => {
    setIsRetrying(true);
    loadMovies();
  };

  useEffect(() => {
    loadMovies();
  }, []);

  const addMovie = async (movieData: any) => {
    await adminService.createMovie(movieData);
    await loadMovies();
  };

  const updateMovie = async (id: number | string, movieData: any) => {
    await adminService.updateMovie(id, movieData);
    await loadMovies();
  };

  const deleteMovie = async (id: number | string) => {
    await adminService.deleteMovie(id);
    await loadMovies();
  };

  return { movies, isLoading, isRetrying, refetchMovies: loadMovies, retry, addMovie, updateMovie, deleteMovie };
};
