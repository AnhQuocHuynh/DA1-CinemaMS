import { useEffect, useState } from 'react';
import { bookingService } from '../services/apiService';
import { TicketDetails } from '../types/booking';

export const useTicketDetails = (ticketId: string) => {
  const [ticket, setTicket] = useState<TicketDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTicket = async () => {
      try {
        const data = await bookingService.getTicketById(ticketId);
        setTicket(data);
      } catch (error) {
        console.error('Failed to load ticket details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTicket();
  }, [ticketId]);

  return { ticket, isLoading };
};
