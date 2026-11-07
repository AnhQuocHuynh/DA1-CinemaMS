import { useState, useEffect } from 'react';
import { recommendationService, MovieRecommendation } from '../services/recommendationService';
import { useAuthStore } from '../store/authStore';

export const useRecommendations = (limit: number = 4) => {
  const [recommendations, setRecommendations] = useState<MovieRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    let isMounted = true;

    const fetchRecommendations = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        let data: MovieRecommendation[] = [];
        
        // If user is logged in, fetch personalized recommendations with fallback to popular
        if (user) {
          try {
            data = await recommendationService.getPersonalized(limit);
          } catch (personalizedErr) {
            console.warn('[useRecommendations] Personalized recommendations failed, falling back to popular:', personalizedErr);
            data = await recommendationService.getPopular(limit);
          }
        } else {
          data = await recommendationService.getPopular(limit);
        }
        
        if (isMounted) {
          setRecommendations(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to fetch recommendations');
          console.error('Failed to fetch recommendations:', err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchRecommendations();

    return () => {
      isMounted = false;
    };
  }, [limit, user]);

  return { recommendations, isLoading, error };
};
