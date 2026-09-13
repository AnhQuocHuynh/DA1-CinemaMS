import React from 'react';
import { SiteTopNav } from '../../components/SiteTopNav';
import { ProfileSettingsContent } from '../../components/profile/ProfileSettingsContent';
import { useTranslation } from 'react-i18next';

export const Settings: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <SiteTopNav activeLabel="Settings" showSearch={false} />
      <main className="pt-24 px-6 pb-16 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-on-surface">{t('settings.title')}</h1>
          <p className="text-on-surface-variant mt-2">{t('settings.subtitle')}</p>
        </div>

        <ProfileSettingsContent />
      </main>
    </div>
  );
};
