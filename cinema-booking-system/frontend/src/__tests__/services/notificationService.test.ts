import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '../../lib/apiClient';
import { notificationService } from '../../services/notificationService';
import { NotificationItem, UserPreference } from '../../types/notification';

vi.mock('../../lib/apiClient', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getMyNotifications calls /notifications/me and returns data', async () => {
    const mockData: NotificationItem[] = [
      {
        id: '1',
        userId: 10,
        type: 'BOOKING_CONFIRMATION',
        channel: 'PUSH',
        title: 'Booked',
        body: 'Success',
        status: 'SENT',
        createdAt: '2026-10-24T00:00:00Z',
        isRead: false,
      },
    ];

    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockData });

    const result = await notificationService.getMyNotifications();

    expect(apiClient.get).toHaveBeenCalledWith('/notifications/me');
    expect(result).toEqual(mockData);
  });

  it('markAsRead calls PUT /notifications/:id/read', async () => {
    (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: null });

    await notificationService.markAsRead('notif-123');

    expect(apiClient.put).toHaveBeenCalledWith('/notifications/notif-123/read');
  });

  it('markAllAsRead calls PUT /notifications/read-all', async () => {
    (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: null });

    await notificationService.markAllAsRead();

    expect(apiClient.put).toHaveBeenCalledWith('/notifications/read-all');
  });

  it('getPreferences calls GET /preferences/:userId and returns preferences', async () => {
    const mockPref: UserPreference = {
      userId: 42,
      emailEnabled: true,
      smsEnabled: false,
      pushEnabled: true,
      updatedAt: '2026-10-24T00:00:00Z',
    };

    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockPref });

    const result = await notificationService.getPreferences(42);

    expect(apiClient.get).toHaveBeenCalledWith('/preferences/42');
    expect(result).toEqual(mockPref);
  });

  it('updatePreferences calls PUT /preferences/:userId with updated payload', async () => {
    const payload = {
      emailEnabled: false,
      smsEnabled: true,
      pushEnabled: true,
    };
    const mockResponse: UserPreference = {
      userId: 42,
      ...payload,
      updatedAt: '2026-10-24T01:00:00Z',
    };

    (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockResponse });

    const result = await notificationService.updatePreferences(42, payload);

    expect(apiClient.put).toHaveBeenCalledWith('/preferences/42', payload);
    expect(result).toEqual(mockResponse);
  });
});
