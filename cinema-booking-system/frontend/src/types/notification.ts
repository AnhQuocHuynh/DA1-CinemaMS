export type NotificationType =
  | 'BOOKING_CONFIRMATION'
  | 'BOOKING_CANCELLED'
  | 'PAYMENT_RECEIPT'
  | 'PAYMENT_FAILED'
  | 'ORDER_REFUNDED'
  | 'PASSWORD_RESET'
  | 'PROMOTIONAL'
  | 'SHOWTIME_REMINDER'
  | 'REVIEW_MODERATION';

export interface PushNotificationPayload {
  id?: string;
  userId: number;
  type: NotificationType;
  title: string;
  body: string;
  timestamp?: string;
  metadata?: {
    orderId?: number;
    showtimeId?: number;
    movieTitle?: string;
    finalAmount?: number;
    ticketCount?: number;
    failureReason?: string;
    actionType?: 'ORDER_CONFIRMED' | 'ORDER_CANCELLED' | 'PAYMENT_FAILED' | 'ORDER_REFUNDED';
    actionUrl?: string;
    [key: string]: unknown;
  };
}

export interface NotificationItem {
  id: string;
  userId: number;
  type: NotificationType;
  channel: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  status: string;
  retryCount?: number;
  sentAt?: string;
  createdAt: string;
  isRead: boolean;
  readAt?: string;
}

export interface UserPreference {
  userId: number;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  updatedAt?: string;
  contact?: {
    email?: string;
    phoneNumber?: string;
  };
}
