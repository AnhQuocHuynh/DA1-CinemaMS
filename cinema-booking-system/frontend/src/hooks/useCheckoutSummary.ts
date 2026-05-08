import { useEffect, useState } from 'react';
import { bookingService } from '../services/apiService';

interface CheckoutSummary {
  movieTitle: string;
  venue: string;
  showtime: string;
  seats: string[];
  subtotal: number;
  fees: number;
  total: number;
}

export const useCheckoutSummary = () => {
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await bookingService.getCheckoutSummary();
        setSummary(data);
      } catch (error) {
        console.error('Failed to load checkout summary:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSummary();
  }, []);

  return { summary, isLoading };
};
