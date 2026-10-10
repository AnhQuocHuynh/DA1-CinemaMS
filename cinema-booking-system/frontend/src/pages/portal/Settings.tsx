import React from 'react';
import { SiteTopNav } from '../../components/SiteTopNav';
import { ProfileSettingsContent } from '../../components/profile/ProfileSettingsContent';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useTranslation } from 'react-i18next';

export const Settings: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <SiteTopNav activeLabel="Settings" showSearch={false} />
      <main className="pt-24 px-6 pb-16 max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">{t('settings.title', 'Settings')}</h1>
          <p className="text-on-surface-variant mt-2">{t('settings.subtitle', 'Manage your account preferences and profile.')}</p>
        </div>

        <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/50">
          <h2 className="text-xl font-bold text-on-surface mb-6">{t('settings.systemPreferences', 'System Preferences')}</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30">
              <div>
                <p className="font-medium text-on-surface">{t('settings.language', 'Language')}</p>
                <p className="text-sm text-on-surface-variant">{t('settings.languageDesc', 'Choose your preferred language.')}</p>
              </div>
              <LanguageSwitcher />
            </div>
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="font-medium text-on-surface">{t('settings.theme', 'Theme')}</p>
                <p className="text-sm text-on-surface-variant">{t('settings.themeDesc', 'Choose between light, dark, or system mode.')}</p>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>

        <ProfileSettingsContent />
      </main>
    </div>
  );
};

