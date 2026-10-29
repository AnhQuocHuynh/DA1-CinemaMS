import { create } from 'zustand';
import { NotificationItem, PushNotificationPayload } from '../types/notification';
import { notificationService } from '../services/notificationService';

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  isConnected: boolean;
  isLoading: boolean;
  lastReceivedNotification: PushNotificationPayload | null;

  setNotifications: (items: NotificationItem[]) => void;
  addNotification: (payload: PushNotificationPayload) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  setIsConnected: (connected: boolean) => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isConnected: false,
  isLoading: false,
  lastReceivedNotification: null,

  setNotifications: (items) => {
    const unreadCount = items.filter((n) => !n.isRead).length;
    set({ notifications: items, unreadCount });
  },

  addNotification: (payload) => {
    const newItem: NotificationItem = {
      id: payload.id || `notif-${Date.now()}`,
      userId: payload.userId,
      type: payload.type,
      channel: 'PUSH',
      title: payload.title,
      body: payload.body,
      metadata: payload.metadata,
      status: 'SENT',
      createdAt: payload.timestamp || new Date().toISOString(),
      isRead: false,
    };

    set((state) => {
      // Prevent duplicates by ID
      const exists = state.notifications.some((n) => n.id === newItem.id);
      if (exists) {
        return state;
      }
      const updated = [newItem, ...state.notifications];
      return {
        notifications: updated,
        unreadCount: state.unreadCount + 1,
        lastReceivedNotification: payload,
      };
    });
  },

  markAsRead: async (id: string) => {
    // Optimistic update
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
      );
      const unreadCount = updated.filter((n) => !n.isRead).length;
      return { notifications: updated, unreadCount };
    });

    try {
      await notificationService.markAsRead(id);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      // Re-fetch to sync
      get().fetchNotifications();
    }
  },

  markAllAsRead: async () => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) => ({
        ...n,
        isRead: true,
        readAt: new Date().toISOString(),
      })),
      unreadCount: 0,
    }));

    try {
      await notificationService.markAllAsRead();
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      get().fetchNotifications();
    }
  },

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const items = await notificationService.getMyNotifications();
      const unreadCount = items.filter((n) => !n.isRead).length;
      set({ notifications: items, unreadCount, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      set({ isLoading: false });
    }
  },

  setIsConnected: (connected: boolean) => set({ isConnected: connected }),

  clearNotifications: () =>
    set({
      notifications: [],
      unreadCount: 0,
      isConnected: false,
      lastReceivedNotification: null,
    }),
}));
