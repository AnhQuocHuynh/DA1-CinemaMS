import * as signalR from '@microsoft/signalr';
import keycloak from '../lib/keycloak';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { PushNotificationPayload } from '../types/notification';

class NotificationHubService {
  private connection: signalR.HubConnection | null = null;
  private isStarting = false;

  public async startConnection(): Promise<void> {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return;
    }
    if (this.isStarting) {
      return;
    }

    const token = useAuthStore.getState().token || keycloak.token;
    if (!token) {
      return;
    }

    this.isStarting = true;

    // Use API Gateway hub URL
    const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    // Remove trailing /api to reach /hubs/notifications via gateway
    const hubBaseUrl = rawBaseUrl.replace(/\/api\/?$/, '');
    const hubUrl = `${hubBaseUrl}/hubs/notifications`;

    try {
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => {
            const currentToken = useAuthStore.getState().token || keycloak.token || '';
            return currentToken;
          },
          skipNegotiation: false,
          transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      this.connection.on('ReceiveNotification', (payload: PushNotificationPayload) => {
        // 1. Update notification store
        useNotificationStore.getState().addNotification(payload);

        // 2. Dispatch custom event for reactive page listeners
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('cinema-push-notification', { detail: payload })
          );
        }

        // 3. If tab is in background and desktop permissions are granted, show desktop notification
        if (
          typeof document !== 'undefined' &&
          document.hidden &&
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          try {
            new Notification(payload.title, {
              body: payload.body,
              icon: '/favicon.ico',
              data: { actionUrl: payload.metadata?.actionUrl || '/' },
            });
          } catch (e) {
            console.error('Failed to trigger native notification:', e);
          }
        }
      });

      this.connection.onreconnecting(() => {
        useNotificationStore.getState().setIsConnected(false);
      });

      this.connection.onreconnected(() => {
        useNotificationStore.getState().setIsConnected(true);
      });

      this.connection.onclose(() => {
        useNotificationStore.getState().setIsConnected(false);
      });

      await this.connection.start();
      useNotificationStore.getState().setIsConnected(true);
    } catch (err) {
      console.warn('[NotificationHubService] Failed to establish SignalR connection:', err);
      useNotificationStore.getState().setIsConnected(false);
    } finally {
      this.isStarting = false;
    }
  }

  public async stopConnection(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.stop();
      } catch (err) {
        console.warn('[NotificationHubService] Error stopping connection:', err);
      } finally {
        this.connection = null;
        useNotificationStore.getState().setIsConnected(false);
      }
    }
  }
}

export const notificationHubService = new NotificationHubService();
