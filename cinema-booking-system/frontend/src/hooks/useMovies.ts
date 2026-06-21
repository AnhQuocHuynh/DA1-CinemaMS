import { useEffect, useState } from 'react';
import { movieService, MovieResponse } from '../services/movieService';

/**
 * Hook that fetches movies from the backend API.
 *
 * When the backend is unreachable the hook returns an empty list
 * so callers can fall back to mock data if they want.
 *
 * TODO: Remove mock-data fallback once the backend is stable.
 */
export function useMovies() {
  const [backendMovies, setBackendMovies] = useState<MovieResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    movieService
      .getMovies()
      .then((movies) => {
        if (!cancelled) {
          setBackendMovies(movies);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('[useMovies] Backend unreachable, falling back to mock data.', err);
          setError('Không thể kết nối đến máy chủ.');
          setBackendMovies([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { backendMovies, isLoading, error };
}
