import React from 'react';
import { StaffLayout } from '../../components/staff/StaffLayout';
import { ProfileSettingsContent } from '../../components/profile/ProfileSettingsContent';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

export const StaffSettings: React.FC = () => {
  const { t } = useTranslation();
  return (
    <StaffLayout activeItemId="settings">
      <main className="p-6 md:p-10 bg-surface min-h-screen">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-on-surface">{t('staffSettings.title', 'Settings')}</h1>
          <p className="text-on-surface-variant mt-2">{t('staffSettings.subtitle', 'Manage your account preferences and profile.')}</p>
        </div>

        <div className="max-w-4xl space-y-8">
          <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/50">
            <h2 className="text-xl font-bold text-on-surface mb-6">{t('staffSettings.systemPreferences', 'System Preferences')}</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-on-surface">{t('staffSettings.language', 'Language')}</p>
                <p className="text-sm text-on-surface-variant">{t('staffSettings.languageDesc', 'Choose your preferred language for the staff interface.')}</p>
              </div>
              <LanguageSwitcher />
            </div>
          </div>
          <ProfileSettingsContent />
        </div>
      </main>
    </StaffLayout>
  );
};
