import React, { useEffect, useState } from 'react';
import { Bell, Mail, MessageSquare, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { notificationService } from '../../services/notificationService';
import { useToast } from '../../contexts/ToastContext';

export const NotificationPreferencesCard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { addToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const numericUserId = parseInt(user.id, 10);
    if (isNaN(numericUserId)) return;

    setIsLoading(true);
    notificationService
      .getPreferences(numericUserId)
      .then((pref) => {
        if (pref) {
          setEmailEnabled(pref.emailEnabled ?? true);
          setSmsEnabled(pref.smsEnabled ?? true);
          setPushEnabled(pref.pushEnabled ?? true);
        }
      })
      .catch((err) => {
        console.warn('Failed to load user preferences, defaulting to enabled:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [user?.id]);

  const handlePushToggle = async () => {
    const nextState = !pushEnabled;
    if (nextState && 'Notification' in window && Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        addToast(
          t('notifications.permissionDenied', 'Browser push notification permission was denied.'),
          'error'
        );
        return;
      }
    }
    setPushEnabled(nextState);
    await savePreferences(emailEnabled, smsEnabled, nextState);
  };

  const handleEmailToggle = async () => {
    const nextState = !emailEnabled;
    setEmailEnabled(nextState);
    await savePreferences(nextState, smsEnabled, pushEnabled);
  };

  const handleSmsToggle = async () => {
    const nextState = !smsEnabled;
    setSmsEnabled(nextState);
    await savePreferences(emailEnabled, nextState, pushEnabled);
  };

  const savePreferences = async (email: boolean, sms: boolean, push: boolean) => {
    if (!user?.id) return;
    const numericUserId = parseInt(user.id, 10);
    if (isNaN(numericUserId)) return;

    setIsSaving(true);
    try {
      await notificationService.updatePreferences(numericUserId, {
        emailEnabled: email,
        smsEnabled: sms,
        pushEnabled: push,
      });
      addToast(
        t('notifications.preferencesSaved', 'Notification preferences updated.'),
        'success'
      );
    } catch (err) {
      console.error('Failed to update preferences:', err);
      addToast(
        t('notifications.preferencesError', 'Failed to update preferences.'),
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-on-surface">
            {t('settings.notificationPreferences', 'Notification Preferences')}
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            {t(
              'settings.notificationPreferencesDesc',
              'Choose how you want to be notified about bookings, payments, and reminders.'
            )}
          </p>
        </div>
        {isSaving && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-sm text-on-surface-variant">Loading preferences...</div>
      ) : (
        <div className="space-y-5">
          {/* Push Notifications */}
          <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary mt-0.5">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-on-surface">
                  {t('settings.pushNotifications', 'In-App & Browser Push')}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {t(
                    'settings.pushNotificationsDesc',
                    'Receive real-time alerts for booking confirmation and seat expiration.'
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handlePushToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                pushEnabled ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  pushEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Email Notifications */}
          <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary mt-0.5">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-on-surface">
                  {t('settings.emailNotifications', 'Email Confirmations')}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {t(
                    'settings.emailNotificationsDesc',
                    'Receive ticket PDFs and payment receipts via email.'
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleEmailToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                emailEnabled ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  emailEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* SMS Notifications */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary mt-0.5">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-on-surface">
                  {t('settings.smsNotifications', 'SMS Alerts')}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {t(
                    'settings.smsNotificationsDesc',
                    'Get showtime reminder codes and urgent updates on your phone.'
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSmsToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                smsEnabled ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  smsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
