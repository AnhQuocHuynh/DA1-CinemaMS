import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNotificationStore } from '../../store/notificationStore';
import { notificationService } from '../../services/notificationService';
import { NotificationItem, PushNotificationPayload } from '../../types/notification';

vi.mock('../../services/notificationService', () => ({
  notificationService: {
    getMyNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

describe('useNotificationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNotificationStore.getState().clearNotifications();
  });

  it('initializes with default empty state', () => {
    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([]);
    expect(state.unreadCount).toBe(0);
    expect(state.isConnected).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.lastReceivedNotification).toBeNull();
  });

  it('addNotification adds item to the front and increments unreadCount', () => {
    const payload: PushNotificationPayload = {
      id: 'notif-1',
      userId: 101,
      type: 'BOOKING_CONFIRMATION',
      title: 'Booking Confirmed',
      body: 'Your ticket has been booked successfully.',
      metadata: { orderId: 123 },
      timestamp: '2026-10-24T10:00:00Z',
    };

    useNotificationStore.getState().addNotification(payload);

    const state = useNotificationStore.getState();
    expect(state.notifications.length).toBe(1);
    expect(state.notifications[0].id).toBe('notif-1');
    expect(state.notifications[0].title).toBe('Booking Confirmed');
    expect(state.notifications[0].isRead).toBe(false);
    expect(state.unreadCount).toBe(1);
    expect(state.lastReceivedNotification).toEqual(payload);
  });

  it('addNotification avoids duplicate notifications with the same id', () => {
    const payload: PushNotificationPayload = {
      id: 'notif-duplicate',
      userId: 101,
      type: 'BOOKING_CONFIRMATION',
      title: 'Booking Confirmed',
      body: 'Duplicate test',
    };

    useNotificationStore.getState().addNotification(payload);
    useNotificationStore.getState().addNotification(payload);

    const state = useNotificationStore.getState();
    expect(state.notifications.length).toBe(1);
    expect(state.unreadCount).toBe(1);
  });

  it('markAsRead updates item isRead status and updates unreadCount', async () => {
    const payload1: PushNotificationPayload = {
      id: 'notif-1',
      userId: 101,
      type: 'BOOKING_CONFIRMATION',
      title: 'One',
      body: 'First',
    };
    const payload2: PushNotificationPayload = {
      id: 'notif-2',
      userId: 101,
      type: 'PAYMENT_FAILED',
      title: 'Two',
      body: 'Second',
    };

    useNotificationStore.getState().addNotification(payload1);
    useNotificationStore.getState().addNotification(payload2);

    expect(useNotificationStore.getState().unreadCount).toBe(2);

    (notificationService.markAsRead as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

    await useNotificationStore.getState().markAsRead('notif-1');

    const state = useNotificationStore.getState();
    const item1 = state.notifications.find((n) => n.id === 'notif-1');
    const item2 = state.notifications.find((n) => n.id === 'notif-2');

    expect(item1?.isRead).toBe(true);
    expect(item1?.readAt).toBeDefined();
    expect(item2?.isRead).toBe(false);
    expect(state.unreadCount).toBe(1);
    expect(notificationService.markAsRead).toHaveBeenCalledWith('notif-1');
  });

  it('markAllAsRead marks all notifications as read and resets unreadCount', async () => {
    useNotificationStore.getState().addNotification({
      id: 'notif-1',
      userId: 101,
      type: 'BOOKING_CONFIRMATION',
      title: 'One',
      body: 'First',
    });
    useNotificationStore.getState().addNotification({
      id: 'notif-2',
      userId: 101,
      type: 'PAYMENT_FAILED',
      title: 'Two',
      body: 'Second',
    });

    (notificationService.markAllAsRead as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

    await useNotificationStore.getState().markAllAsRead();

    const state = useNotificationStore.getState();
    expect(state.notifications.every((n) => n.isRead)).toBe(true);
    expect(state.unreadCount).toBe(0);
    expect(notificationService.markAllAsRead).toHaveBeenCalled();
  });

  it('fetchNotifications retrieves notifications from service and updates state', async () => {
    const mockItems: NotificationItem[] = [
      {
        id: 'n-1',
        userId: 101,
        type: 'BOOKING_CONFIRMATION',
        channel: 'PUSH',
        title: 'Title 1',
        body: 'Body 1',
        status: 'SENT',
        createdAt: '2026-10-24T10:00:00Z',
        isRead: false,
      },
      {
        id: 'n-2',
        userId: 101,
        type: 'BOOKING_CANCELLED',
        channel: 'PUSH',
        title: 'Title 2',
        body: 'Body 2',
        status: 'SENT',
        createdAt: '2026-10-24T09:00:00Z',
        isRead: true,
      },
    ];

    (notificationService.getMyNotifications as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockItems);

    await useNotificationStore.getState().fetchNotifications();

    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual(mockItems);
    expect(state.unreadCount).toBe(1);
    expect(state.isLoading).toBe(false);
  });

  it('clearNotifications resets store state', () => {
    useNotificationStore.getState().addNotification({
      id: 'notif-1',
      userId: 101,
      type: 'BOOKING_CONFIRMATION',
      title: 'One',
      body: 'First',
    });
    useNotificationStore.getState().setIsConnected(true);

    useNotificationStore.getState().clearNotifications();

    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([]);
    expect(state.unreadCount).toBe(0);
    expect(state.isConnected).toBe(false);
    expect(state.lastReceivedNotification).toBeNull();
  });
});
