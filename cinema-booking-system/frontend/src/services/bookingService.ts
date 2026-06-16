import apiClient from './authService';
import {
  BackendOrder,
  BackendVoucher,
  Seat,
  SeatMap,
  SeatRow,
  TicketDetails,
} from '../types/booking';
import { ShowtimeSeatResponse } from '../types/showtime';
import { parseVND } from '../utils/formatters';

// ── Seat map ────────────────────────────────────────────────────────────────

/**
 * GET /showtimes/{showtimeId}/seats
 * Returns a flat array; we group by rowLabel to build the SeatMap grid.
 */
export const bookingService = {
  getSeatMap: async (showtimeId: string | number): Promise<SeatMap> => {
    const response = await apiClient.get<{ success: boolean; data: ShowtimeSeatResponse[] }>(
      `/showtimes/${showtimeId}/seats`
    );

    const apiSeats: ShowtimeSeatResponse[] = response.data?.data ?? [];

    // Group by rowLabel preserving row order
    const rowMap = new Map<string, Seat[]>();
    for (const s of apiSeats) {
      const seat: Seat = {
        id: String(s.id),
        numericId: s.id,
        label: s.label,
        row: s.rowLabel,
        number: s.columnNumber,
        status: s.isPathway ? 'available' : (s.status as Seat['status']),
        type: s.seatType as Seat['type'],
        price: parseVND(s.price),
        isPathway: s.isPathway,
      };

      if (!rowMap.has(s.rowLabel)) {
        rowMap.set(s.rowLabel, []);
      }
      rowMap.get(s.rowLabel)!.push(seat);
    }

    const rows: SeatRow[] = Array.from(rowMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([rowLabel, seats]) => ({
        rowLabel,
        seats: seats.sort((a, b) => a.number - b.number),
      }));

    return { rows };
  },

  // ── Seat hold ─────────────────────────────────────────────────────────────

  /**
   * POST /showtimes/{showtimeId}/hold
   * seatIds are the ShowtimeSeat PKs (numeric).
   */
  holdSeats: async (showtimeId: string | number, seatIds: number[]): Promise<void> => {
    await apiClient.post(`/showtimes/${showtimeId}/hold`, { seatIds });
  },

  /**
   * DELETE /showtimes/{showtimeId}/hold
   * Releases previously held seats so other users can select them.
   */
  releaseHeldSeats: async (showtimeId: string | number, seatIds: number[]): Promise<void> => {
    await apiClient.delete(`/showtimes/${showtimeId}/hold`, { data: { seatIds } });
  },

  // ── Voucher ───────────────────────────────────────────────────────────────

  /** GET /vouchers/validate/{code} — raw Voucher (no ApiResponse wrapper) */
  validateVoucher: async (code: string): Promise<BackendVoucher> => {
    const response = await apiClient.get<BackendVoucher>(`/vouchers/validate/${code}`);
    return response.data;
  },

  // ── Order ─────────────────────────────────────────────────────────────────

  /**
   * POST /orders — raw Order response (no ApiResponse wrapper)
   */
  createOrder: async (payload: {
    userId: number;
    showtimeId: number;
    seatIds: number[];
    voucherCode?: string | null;
  }): Promise<BackendOrder> => {
    const response = await apiClient.post<BackendOrder>('/orders', {
      userId: payload.userId,
      showtimeId: payload.showtimeId,
      seatIds: payload.seatIds,
      voucherCode: payload.voucherCode || null,
    });
    return response.data;
  },

  /**
   * POST /orders/{id}/pay — raw Order response
   */
  processPayment: async (
    orderId: number,
    paymentMethod: 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'WALLET',
    transactionId: string
  ): Promise<BackendOrder> => {
    const response = await apiClient.post<BackendOrder>(`/orders/${orderId}/pay`, {
      paymentMethod,
      transactionId,
    });
    return response.data;
  },

  // ── Tickets ───────────────────────────────────────────────────────────────

  /** GET /tickets/code/{ticketCode} — raw TicketResponse */
  getTicketByCode: async (ticketCode: string): Promise<TicketDetails> => {
    const response = await apiClient.get<{
      id: number;
      orderId: number;
      userId: number;
      showtimeSeatId: number;
      ticketCode: string;
      qrCodeData: string;
      price: string;
      status: string;
      checkedInAt: string | null;
      createdAt: string;
      movieName?: string;
      showtimeDateTime?: string;
      cinemaName?: string;
      hallName?: string;
    }>(`/tickets/code/${ticketCode}`);

    const raw = response.data;
    const dt = raw.showtimeDateTime ? new Date(raw.showtimeDateTime) : null;

    return {
      ticketCode: raw.ticketCode,
      orderId: raw.orderId,
      movieTitle: raw.movieName || '',
      cinemaName: raw.cinemaName || '',
      hallName: raw.hallName || '',
      showtime: raw.showtimeDateTime || '',
      date: dt ? dt.toLocaleDateString('vi-VN') : '',
      time: dt ? dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '',
      seats: [],
      qrCodeData: raw.qrCodeData,
      price: parseVND(raw.price),
      status: raw.status,
      posterUrl: '',
    };
  },

  /** GET /tickets/users/{userId} — array of raw TicketResponse */
  getUserTickets: async (userId: number) => {
    const response = await apiClient.get<
      Array<{
        id: number;
        orderId: number;
        ticketCode: string;
        price: string;
        status: string;
        createdAt: string;
        movieName?: string;
        showtimeDateTime?: string;
        cinemaName?: string;
        hallName?: string;
      }>
    >(`/tickets/users/${userId}`);
    return response.data ?? [];
  },

  // ── Orders ────────────────────────────────────────────────────────────────

  /** GET /tickets/orders/{orderId} — all tickets for an order */
  getOrderTickets: async (orderId: number) => {
    const response = await apiClient.get<
      Array<{
        id: number;
        orderId: number;
        ticketCode: string;
        qrCodeData: string;
        price: string;
        status: string;
        createdAt: string;
        movieName?: string;
        showtimeDateTime?: string;
        cinemaName?: string;
        hallName?: string;
      }>
    >(`/tickets/orders/${orderId}`);
    return response.data ?? [];
  },

  // ── Refund ────────────────────────────────────────────────────────────────

  refundOrder: async (orderId: number, reason: string): Promise<BackendOrder> => {
    const response = await apiClient.post<BackendOrder>(`/orders/${orderId}/refund`, { reason });
    return response.data;
  },

  // ── Check-in ──────────────────────────────────────────────────────────────

  checkInTicket: async (ticketCode: string) => {
    const response = await apiClient.post(`/tickets/check-in`, { ticketCode });
    return response.data;
  },
};
