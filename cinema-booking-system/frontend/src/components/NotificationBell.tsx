import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, Clock, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';
import { NotificationItem } from '../types/notification';

export const NotificationBell: React.FC = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { user } = useAuthStore();
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    isLoading,
  } = useNotificationStore();

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      await markAsRead(item.id);
    }

    const actionUrl = item.metadata?.actionUrl as string | undefined;
    if (actionUrl) {
      if (actionUrl.startsWith('http')) {
        window.location.href = actionUrl;
      } else {
        navigate(actionUrl);
      }
      setIsOpen(false);
    }
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return t('notifications.justNow', 'Just now');
    if (diffSec < 3600) return t('notifications.minutesAgo', '{{count}}m ago', { count: Math.floor(diffSec / 60) });
    if (diffSec < 86400) return t('notifications.hoursAgo', '{{count}}h ago', { count: Math.floor(diffSec / 3600) });
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'BOOKING_CONFIRMATION':
      case 'ORDER_CONFIRMED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'PAYMENT_FAILED':
      case 'BOOKING_CANCELLED':
        return <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'ORDER_REFUNDED':
        return <RefreshCw className="w-4 h-4 text-sky-400 shrink-0" />;
      default:
        return <Clock className="w-4 h-4 text-amber-400 shrink-0" />;
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-all focus:outline-none"
        aria-label={t('notifications.title', 'Notifications')}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full ring-2 ring-zinc-900 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">{t('notifications.title', 'Notifications')}</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300">
                  {unreadCount} {t('notifications.new', 'new')}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-amber-400 transition-colors"
                title={t('notifications.markAllRead', 'Mark all read')}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{t('notifications.markAllRead', 'Mark all read')}</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-zinc-800/60 custom-scrollbar">
            {isLoading && notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">{t('notifications.loading', 'Loading...')}</div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center justify-center text-zinc-500 gap-2">
                <Bell className="w-8 h-8 opacity-30 stroke-1" />
                <span className="text-xs">{t('notifications.noNotifications', 'No notifications yet')}</span>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3.5 flex gap-3 transition-colors cursor-pointer text-left ${
                    item.isRead
                      ? 'bg-transparent hover:bg-zinc-800/40 opacity-75'
                      : 'bg-zinc-800/30 hover:bg-zinc-800/60'
                  }`}
                >
                  <div className="mt-0.5">{getNotificationIcon(item.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p
                        className={`text-xs font-semibold truncate ${
                          item.isRead ? 'text-zinc-300' : 'text-white'
                        }`}
                      >
                        {item.title}
                      </p>
                      <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                        {formatTimestamp(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                  {!item.isRead && (
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 self-center" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
