import apiClient from './authService';
import {
  StaffBookingListItem,
  StaffBookingValidation,
  StaffDashboardSummary,
  StaffScanResult,
  StaffValidationStats,
} from '../types/staff';

export const staffService = {
  getStaffDashboard: async (): Promise<StaffDashboardSummary> => {
    const response = await apiClient.get<{ success: boolean; data: StaffDashboardSummary }>(
      '/staff/dashboard/summary'
    );
    return response.data.data;
  },

  getBookingsList: async (): Promise<StaffBookingListItem[]> => {
    const response = await apiClient.get<{ success: boolean; data: StaffBookingListItem[] }>(
      '/staff/dashboard/bookings/today?limit=10'
    );
    return response.data.data ?? [];
  },

  getValidationStats: async (): Promise<StaffValidationStats> => {
    const response = await apiClient.get<{ success: boolean; data: StaffValidationStats }>(
      '/staff/dashboard/validation/stats'
    );
    return response.data.data;
  },

  getValidationBookings: async (): Promise<StaffBookingValidation[]> => {
    const response = await apiClient.get<{ success: boolean; data: StaffBookingValidation[] }>(
      '/staff/dashboard/validation/bookings?limit=20'
    );
    return response.data.data ?? [];
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
      movieTitle: response.data.movieTitle || 'Unknown movie',
      showtime,
      status: response.data.status === 'CHECKED_IN' ? 'validated' : 'pending',
    };
  },
};
