import { create } from 'zustand';
import { Seat, BackendOrder, BackendVoucher } from '../types/booking';
import { ShowtimeResponse } from '../types/showtime';

interface BookingState {
  // Seat selection
  selectedSeats: Seat[];
  showtimeId: string | null;
  holdExpiresAt: Date | null;     // absolute Date when hold expires

  // Showtime & movie context (fetched on Booking page)
  showtimeData: ShowtimeResponse | null;
  movieTitle: string | null;
  moviePosterUrl: string | null;

  // Voucher
  voucher: BackendVoucher | null;

  // Order (set after POST /orders)
  pendingOrder: BackendOrder | null;

  // Completed order (set after POST /orders/{id}/pay)
  completedOrder: BackendOrder | null;

  // Actions
  setShowtimeId: (showtimeId: string | null) => void;
  setHoldExpiresAt: (value: Date | null) => void;
  setShowtimeData: (data: ShowtimeResponse | null) => void;
  setMovieTitle: (title: string | null) => void;
  setMoviePosterUrl: (url: string | null) => void;
  setVoucher: (voucher: BackendVoucher | null) => void;
  setPendingOrder: (order: BackendOrder | null) => void;
  setCompletedOrder: (order: BackendOrder | null) => void;
  toggleSeat: (seat: Seat) => void;
  clearSelection: () => void;
}

export const useBookingStore = create<BookingState>((set, get) => ({
  selectedSeats: [],
  showtimeId: null,
  holdExpiresAt: null,
  showtimeData: null,
  movieTitle: null,
  moviePosterUrl: null,
  voucher: null,
  pendingOrder: null,
  completedOrder: null,

  setShowtimeId: (showtimeId) => set({ showtimeId }),
  setHoldExpiresAt: (value) => set({ holdExpiresAt: value }),
  setShowtimeData: (data) => set({ showtimeData: data }),
  setMovieTitle: (title) => set({ movieTitle: title }),
  setMoviePosterUrl: (url) => set({ moviePosterUrl: url }),
  setVoucher: (voucher) => set({ voucher }),
  setPendingOrder: (order) => set({ pendingOrder: order }),
  setCompletedOrder: (order) => set({ completedOrder: order }),

  toggleSeat: (seat) => {
    const current = get().selectedSeats;
    const exists = current.some((item) => item.id === seat.id);
    
    if (exists) {
      set({ selectedSeats: current.filter((item) => item.id !== seat.id) });
    } else {
      const maxSeats = 6;
      const currentPhysicalCount = current.reduce(
        (total, s) => total + (s.type === 'couple' ? 2 : 1),
        0
      );
      const addingPhysicalCount = seat.type === 'couple' ? 2 : 1;
      
      if (currentPhysicalCount + addingPhysicalCount > maxSeats) {
        throw new Error(`Booking limit exceeded. You can select a maximum of ${maxSeats} physical seats.`);
      }

      set({ selectedSeats: [...current, { ...seat, status: 'selected' }] });
    }
  },

  clearSelection: () =>
    set({
      selectedSeats: [],
      showtimeId: null,
      holdExpiresAt: null,
      showtimeData: null,
      movieTitle: null,
      moviePosterUrl: null,
      voucher: null,
      pendingOrder: null,
    }),
}));
