import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationHubService } from '../../services/notificationHubService';
import { useNotificationStore } from '../../store/notificationStore';
import { PushNotificationPayload } from '../../types/notification';

const handlers: Record<string, Function> = {};

const mockConnection = {
  state: 'Disconnected',
  on: vi.fn((event: string, callback: Function) => {
    handlers[event] = callback;
  }),
  onreconnecting: vi.fn(),
  onreconnected: vi.fn(),
  onclose: vi.fn(),
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@microsoft/signalr', () => {
  return {
    HubConnectionBuilder: vi.fn().mockImplementation(() => {
      return {
        withUrl: vi.fn().mockReturnThis(),
        withAutomaticReconnect: vi.fn().mockReturnThis(),
        configureLogging: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnValue(mockConnection),
      };
    }),
    HubConnectionState: {
      Connected: 'Connected',
      Disconnected: 'Disconnected',
    },
    HttpTransportType: {
      WebSockets: 1,
      LongPolling: 4,
    },
    LogLevel: {
      Warning: 2,
    },
  };
});

vi.mock('../../store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn().mockReturnValue({ token: 'mock-jwt-token' }),
  },
}));

vi.mock('../../lib/keycloak', () => ({
  default: {
    token: 'mock-jwt-token',
  },
}));

describe('notificationHubService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (globalThis as any).window = {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    (globalThis as any).CustomEvent = class CustomEvent {
      type: string;
      detail: any;
      constructor(type: string, params: { detail?: any } = {}) {
        this.type = type;
        this.detail = params.detail;
      }
    };
    await notificationHubService.stopConnection();
    useNotificationStore.getState().clearNotifications();
  });

  it('starts connection and sets isConnected to true on success', async () => {
    await notificationHubService.startConnection();

    expect(mockConnection.start).toHaveBeenCalled();
    expect(useNotificationStore.getState().isConnected).toBe(true);
    expect(mockConnection.on).toHaveBeenCalledWith('ReceiveNotification', expect.any(Function));
  });

  it('handles ReceiveNotification by adding to store and dispatching window event', async () => {
    await notificationHubService.startConnection();

    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    const payload: PushNotificationPayload = {
      id: 'notif-event-1',
      userId: 55,
      type: 'BOOKING_CONFIRMATION',
      title: 'Tickets Confirmed',
      body: 'Your tickets are ready.',
      metadata: { orderId: 123, actionType: 'ORDER_CONFIRMED' },
    };

    // Trigger the registered handler
    expect(handlers['ReceiveNotification']).toBeDefined();
    handlers['ReceiveNotification'](payload);

    // Verify notification was added to store
    const state = useNotificationStore.getState();
    expect(state.notifications.length).toBe(1);
    expect(state.notifications[0].id).toBe('notif-event-1');
    expect(state.unreadCount).toBe(1);

    // Verify window custom event was dispatched
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cinema-push-notification',
        detail: payload,
      })
    );
  });

  it('stops connection and resets isConnected to false', async () => {
    await notificationHubService.startConnection();
    expect(useNotificationStore.getState().isConnected).toBe(true);

    await notificationHubService.stopConnection();

    expect(mockConnection.stop).toHaveBeenCalled();
    expect(useNotificationStore.getState().isConnected).toBe(false);
  });
});
