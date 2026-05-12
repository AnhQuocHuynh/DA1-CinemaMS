import { useEffect, useMemo, useState } from 'react';
import { bookingService } from '../services/bookingService';
import { useBookingStore } from '../store/bookingStore';
import { Seat, SeatMap } from '../types/booking';

export const useSeatSelection = (showtimeId: string) => {
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { selectedSeats, toggleSeat, setShowtimeId } = useBookingStore();

  useEffect(() => {
    const loadSeatMap = async () => {
      try {
        const data = await bookingService.getSeatMap(showtimeId);
        setSeatMap(data);
        setShowtimeId(showtimeId);
      } catch (error) {
        console.error('Failed to load seat map:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSeatMap();
  }, [showtimeId, setShowtimeId]);

  const summary = useMemo(() => {
    const subtotal = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
    const fees = selectedSeats.length ? 4.5 : 0;
    return {
      subtotal,
      fees,
      total: subtotal + fees,
    };
  }, [selectedSeats]);

  const isSelected = (seat: Seat) => selectedSeats.some((item) => item.id === seat.id);

  return { seatMap, selectedSeats, isSelected, toggleSeat, summary, isLoading };
};
