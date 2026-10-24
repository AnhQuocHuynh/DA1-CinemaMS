import apiClient from '../lib/apiClient';
import { NotificationItem, UserPreference } from '../types/notification';

export const notificationService = {
  getMyNotifications: async (): Promise<NotificationItem[]> => {
    const res = await apiClient.get<NotificationItem[]>('/notifications/me');
    return res.data;
  },

  markAsRead: async (id: string): Promise<void> => {
    await apiClient.put(`/notifications/${id}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await apiClient.put('/notifications/read-all');
  },

  getPreferences: async (userId: number): Promise<UserPreference> => {
    const res = await apiClient.get<UserPreference>(`/preferences/${userId}`);
    return res.data;
  },

  updatePreferences: async (
    userId: number,
    payload: { emailEnabled: boolean; smsEnabled: boolean; pushEnabled: boolean }
  ): Promise<UserPreference> => {
    const res = await apiClient.put<UserPreference>(`/preferences/${userId}`, payload);
    return res.data;
  },
};
