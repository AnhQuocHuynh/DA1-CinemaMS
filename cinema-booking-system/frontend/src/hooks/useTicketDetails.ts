import { useEffect, useState } from 'react';
import { bookingService } from '../services/bookingService';
import { TicketDetails } from '../types/booking';

export const useTicketDetails = (ticketCode: string) => {
  const [ticket, setTicket] = useState<TicketDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticketCode) return;

    const loadTicket = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await bookingService.getTicketByCode(ticketCode);
        setTicket(data);
      } catch (err) {
        console.error('Failed to load ticket:', err);
        setError('Không thể tải thông tin vé. Vui lòng thử lại.');
      } finally {
        setIsLoading(false);
      }
    };

    loadTicket();
  }, [ticketCode]);

  return { ticket, isLoading, error };
};
