import { create } from 'zustand';
import { Seat } from '../types/booking';

interface BookingState {
  selectedSeats: Seat[];
  showtimeId: string | null;
  holdExpiresAt: string | null;

  setShowtimeId: (showtimeId: string | null) => void;
  setHoldExpiresAt: (value: string | null) => void;
  toggleSeat: (seat: Seat) => void;
  clearSelection: () => void;
}

export const useBookingStore = create<BookingState>((set, get) => ({
  selectedSeats: [],
  showtimeId: null,
  holdExpiresAt: null,

  setShowtimeId: (showtimeId) => set({ showtimeId }),
  setHoldExpiresAt: (value) => set({ holdExpiresAt: value }),
  toggleSeat: (seat) => {
    const current = get().selectedSeats;
    const exists = current.some((item) => item.id === seat.id);
    set({
      selectedSeats: exists
        ? current.filter((item) => item.id !== seat.id)
        : [...current, { ...seat, status: 'selected' }],
    });
  },
  clearSelection: () => set({ selectedSeats: [], showtimeId: null, holdExpiresAt: null }),
}));
