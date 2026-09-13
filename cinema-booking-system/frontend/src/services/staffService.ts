import apiClient from '../lib/apiClient';
import {
  StaffBookingListItem,
  StaffBookingValidation,
  StaffCounterBookingRequest,
  StaffCounterBookingResult,
  StaffDashboardSummary,
  StaffScanResult,
  StaffValidationStats,
} from '../types/staff';

export const staffService = {
  getStaffDashboard: async (): Promise<StaffDashboardSummary> => {
    console.warn('[STAFF] getStaffDashboard: Endpoint /staff/dashboard/summary is missing in backend.');
    const response = await apiClient.get<{ success: boolean; data: StaffDashboardSummary }>(
      '/staff/dashboard/summary'
    );
    return response.data.data;
  },

  getBookingsList: async (): Promise<StaffBookingListItem[]> => {
    console.warn('[STAFF] getBookingsList: Endpoint /staff/dashboard/bookings/today is missing in backend.');
    const response = await apiClient.get<{ success: boolean; data: StaffBookingListItem[] }>(
      '/staff/dashboard/bookings/today?limit=10'
    );
    return response.data.data ?? [];
  },

  getValidationStats: async (): Promise<StaffValidationStats> => {
    console.warn('[STAFF] getValidationStats: Endpoint /staff/dashboard/validation/stats is missing in backend.');
    const response = await apiClient.get<{ success: boolean; data: StaffValidationStats }>(
      '/staff/dashboard/validation/stats'
    );
    return response.data.data;
  },

  getValidationBookings: async (): Promise<StaffBookingValidation[]> => {
    console.warn('[STAFF] getValidationBookings: Endpoint /staff/dashboard/validation/bookings is missing in backend.');
    const response = await apiClient.get<{ success: boolean; data: StaffBookingValidation[] }>(
      '/staff/dashboard/validation/bookings?limit=20'
    );
    return response.data.data ?? [];
  },

  createCounterBooking: async (
    payload: StaffCounterBookingRequest
  ): Promise<StaffCounterBookingResult> => {
    console.warn('[STAFF] createCounterBooking: Endpoint /staff/bookings is missing in backend.');
    const response = await apiClient.post<{ success: boolean; data: StaffCounterBookingResult }>(
      '/staff/bookings',
      payload
    );
    return response.data.data;
  },

  scanTicket: async (ticketCode: string): Promise<StaffScanResult> => {
    const response = await apiClient.post<{
      ticketCode: string;
      seatLabel?: string;
      seatTypeName?: string;
      status: string;
    }>('/tickets/check-in', { ticketCode });

    return {
      status: response.data.status === 'CHECKED_IN' ? 'valid' : 'invalid',
      seatLabel: response.data.seatLabel || response.data.ticketCode,
      ticketType: response.data.seatTypeName || 'Ticket',
    };
  },

  lookupTicket: async (query: string): Promise<StaffBookingValidation> => {
    const response = await apiClient.get<{
      orderId: number;
      ticketCode: string;
      movieTitle?: string;
      eventTitle?: string;
      displayTitle?: string;
      startTime?: string;
      status: string;
      userId?: number;
    }>(`/tickets/code/${encodeURIComponent(query)}`);

    const showtime = response.data.startTime
      ? new Date(response.data.startTime).toLocaleString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'N/A';

    return {
      id: `#BK-${response.data.orderId}`,
      customerName: response.data.userId ? `Customer #${response.data.userId}` : 'Unknown customer',
      movieTitle: response.data.displayTitle || response.data.movieTitle || response.data.eventTitle || 'Unknown showtime',
      showtime,
      status: response.data.status === 'CHECKED_IN' ? 'validated' : 'pending',
    };
  },
};
