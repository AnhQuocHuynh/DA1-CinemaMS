import apiClient from '../lib/apiClient';
import {
  BackendOrder,
  BackendVoucher,
  SeatMap,
  TicketDetails,
} from '../types/booking';
import { ShowtimeSeatResponse } from '../types/showtime';
import { parseVND } from '../utils/formatters';
import { groupSeatsByRow } from '../utils/seatGridUtils';

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
    const rows = groupSeatsByRow(apiSeats);

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
      movieTitle?: string;
      eventTitle?: string;
      displayTitle?: string;
      startTime?: string;
      endTime?: string;
      cinemaName?: string;
      roomName?: string;
      seatLabel?: string;
      seatTypeName?: string;
    }>(`/tickets/code/${ticketCode}`);

    const raw = response.data;
    const dt = raw.startTime ? new Date(raw.startTime) : null;
    return {
      ticketCode: raw.ticketCode,
      orderId: raw.orderId,
      movieTitle: raw.displayTitle || raw.movieTitle || raw.movieName || raw.eventTitle || '',
      cinemaName: raw.cinemaName || '',
      hallName: raw.roomName || '',
      showtime: raw.startTime || '',
      date: dt ? dt.toLocaleDateString('vi-VN') : '',
      time: dt ? dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '',
      seats: raw.seatLabel ? [raw.seatLabel] : [],
      seatLabel: raw.seatLabel,
      seatTypeName: raw.seatTypeName,
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
        movieTitle?: string;
        eventTitle?: string;
        displayTitle?: string;
        startTime?: string;
        endTime?: string;
        cinemaName?: string;
        roomName?: string;
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
        eventTitle?: string;
        displayTitle?: string;
        startTime?: string;
        endTime?: string;
        cinemaName?: string;
        roomName?: string;
        seatLabel?: string;
        seatTypeName?: string;
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
