import { useCallback, useEffect, useMemo, useState } from 'react';
import { bookingService } from '../services/bookingService';
import { showtimeService } from '../services/showtimeService';
import { useBookingStore } from '../store/bookingStore';
import { Seat, SeatMap } from '../types/booking';
import { useToast } from '../contexts/ToastContext';

export const useSeatSelection = (showtimeId: string) => {
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const { addToast } = useToast();

  const {
    selectedSeats,
    toggleSeat,
    setShowtimeId,
    setShowtimeData,
    setHoldExpiresAt,
  } = useBookingStore();

  const fetchSeatMap = useCallback(async () => {
    try {
      const [seatData, showtimeData] = await Promise.all([
        bookingService.getSeatMap(showtimeId),
        showtimeService.getShowtime(showtimeId),
      ]);

      const heldByMe = new Set(selectedSeats.map((s) => s.id));
      if (heldByMe.size > 0) {
        for (const row of seatData.rows) {
          for (const seat of row.seats) {
            if (heldByMe.has(seat.id) && seat.status === 'holding') {
              seat.status = 'available';
            }
          }
        }
      }

      setSeatMap(seatData);
      setShowtimeId(showtimeId);
      setShowtimeData(showtimeData);
    } catch (err) {
      console.error('Failed to load seat map:', err);
      setError('Unable to load seat map. Please try again.');
    }
  }, [showtimeId, selectedSeats, setShowtimeId, setShowtimeData]);

  useEffect(() => {
    if (!showtimeId) return;

    const init = async () => {
      setIsLoading(true);
      setError(null);
      await fetchSeatMap();
      setIsLoading(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showtimeId]);

  const summary = useMemo(() => {
    const subtotal = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
    return { subtotal, total: subtotal };
  }, [selectedSeats]);

  const isSelected = useCallback(
    (seat: Seat) => selectedSeats.some((item) => item.id === seat.id),
    [selectedSeats]
  );

  const handleToggleSeat = useCallback(
    async (seat: Seat) => {
      try {
        const isCurrentlySelected = selectedSeats.some((s) => s.id === seat.id);

        if (isCurrentlySelected) {
          await bookingService.releaseHeldSeats(showtimeId, [seat.numericId]);
          toggleSeat(seat);
          if (selectedSeats.length === 1) {
            setHoldExpiresAt(null);
          }
        } else {
          const maxSeats = 6;
          const currentPhysicalCount = selectedSeats.reduce(
            (total, s) => total + (s.type === 'couple' ? 2 : 1),
            0
          );
          const addingPhysicalCount = seat.type === 'couple' ? 2 : 1;
          
          if (currentPhysicalCount + addingPhysicalCount > maxSeats) {
            throw new Error(`Booking limit exceeded. You can select a maximum of ${maxSeats} physical seats.`);
          }

          await bookingService.holdSeats(showtimeId, [seat.numericId]);
          toggleSeat(seat);
          setHoldExpiresAt(new Date(Date.now() + 10 * 60 * 1000));
        }
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Could not update seat status. It may have just been taken.';
        addToast(msg, 'error');
        // Reload seat map to show the actual status of the seat
        fetchSeatMap();
      }
    },
    [selectedSeats, showtimeId, toggleSeat, setHoldExpiresAt, addToast, fetchSeatMap]
  );

  /** Call POST /showtimes/{id}/hold for all currently selected seats */
  const holdSelectedSeats = useCallback(async (): Promise<boolean> => {
    if (selectedSeats.length === 0) {
      setHoldError('Please select at least one seat.');
      return false;
    }
    setIsHolding(true);
    setHoldError(null);
    try {
      const seatIds = selectedSeats.map((s) => s.numericId);
      await bookingService.holdSeats(showtimeId, seatIds);
      // Hold is 10 minutes from now
      setHoldExpiresAt(new Date(Date.now() + 10 * 60 * 1000));
      return true;
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; errorCode?: string } } };
      const msg =
        axiosErr?.response?.data?.message ||
        'Could not hold seats. They may have just been taken.';
      setHoldError(msg);
      return false;
    } finally {
      setIsHolding(false);
    }
  }, [selectedSeats, showtimeId, setHoldExpiresAt]);

  return {
    seatMap,
    selectedSeats,
    isSelected,
    toggleSeat: handleToggleSeat,
    summary,
    isLoading,
    error,
    holdSelectedSeats,
    isHolding,
    holdError,
  };
};
