import { useMemo } from 'react';
import { useBookingStore } from '../store/bookingStore';
import { BookingSummary } from '../types/booking';

export const useCheckoutSummary = () => {
  const { selectedSeats } = useBookingStore();
  const isLoading = false;

  const summary = useMemo<BookingSummary>(() => {
    const subtotal = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
    const fees = selectedSeats.length ? 4.5 : 0;

    return {
      movieTitle: 'Interstellar: 10th Anniversary Re-release',
      venue: 'IMAX 70mm',
      showtime: '8:30 PM',
      seats: selectedSeats,
      fees,
      subtotal,
      total: subtotal + fees,
    };
  }, [selectedSeats]);

  return { summary, isLoading };
};
