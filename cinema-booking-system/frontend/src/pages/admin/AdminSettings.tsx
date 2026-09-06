import React from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { AdminTopBar } from '../../components/admin/AdminTopBar';
import { ProfileSettingsContent } from '../../components/profile/ProfileSettingsContent';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

export const AdminSettings: React.FC = () => {
  const { t } = useTranslation();
  return (
    <AdminLayout>
      <AdminTopBar
        title={t('adminSettings.console', 'Admin Console')}
        searchPlaceholder={t('adminSettings.search', 'Search operations, venues, or reports...')}
        navLinks={[
          { label: t('adminSettings.analytics', 'Analytics'), to: '/admin/dashboard' },
          { label: t('adminSettings.reports', 'Reports'), to: '/admin/permissions' },
          { label: t('adminSettings.logs', 'Logs'), to: '/admin/showtimes' },
        ]}
      />

      <main className="p-6 md:p-10 bg-surface min-h-screen">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-on-surface">{t('adminSettings.title', 'Settings')}</h1>
          <p className="text-on-surface-variant mt-2">{t('adminSettings.subtitle', 'Manage your account preferences and profile.')}</p>
        </div>

        <div className="max-w-4xl space-y-8">
          <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/50">
            <h2 className="text-xl font-bold text-on-surface mb-6">{t('adminSettings.systemPreferences', 'System Preferences')}</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-on-surface">{t('adminSettings.language', 'Language')}</p>
                <p className="text-sm text-on-surface-variant">{t('adminSettings.languageDesc', 'Choose your preferred language for the admin interface.')}</p>
              </div>
              <LanguageSwitcher />
            </div>
          </div>
          <ProfileSettingsContent />
        </div>
      </main>
    </AdminLayout>
  );
};
