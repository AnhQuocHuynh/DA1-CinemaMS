import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Globe, Monitor, Moon, Palette, Sun } from 'lucide-react';
import { StaffLayout } from '../../components/staff/StaffLayout';
import { ProfileSettingsContent } from '../../components/profile/ProfileSettingsContent';
import { useThemeStore, Theme } from '../../store/themeStore';
import { VietnamFlag } from '../../components/flags/countries/vn';

export const StaffSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useThemeStore();

  const isVi = i18n.language.startsWith('vi');

  const themeOptions: { value: Theme; title: string; desc: string; icon: React.ReactNode }[] = [
    {
      value: 'light',
      title: t('staffSettings.themeLight', 'Light'),
      desc: t('staffSettings.themeLightDesc', 'Clean and bright interface for daytime use.'),
      icon: <Sun className="w-5 h-5 text-amber-500" />,
    },
    {
      value: 'dark',
      title: t('staffSettings.themeDark', 'Dark'),
      desc: t('staffSettings.themeDarkDesc', 'Easy on the eyes in low-light cinema environments.'),
      icon: <Moon className="w-5 h-5 text-blue-400" />,
    },
    {
      value: 'system',
      title: t('staffSettings.themeSystem', 'System'),
      desc: t('staffSettings.themeSystemDesc', 'Automatically match your system or device settings.'),
      icon: <Monitor className="w-5 h-5 text-on-surface-variant" />,
    },
  ];

  return (
    <StaffLayout activeItemId="settings">
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">
            {t('staffSettings.title', 'Settings')}
          </h1>
          <p className="text-on-surface-variant mt-1.5 text-sm">
            {t('staffSettings.subtitle', 'Manage your account preferences, display theme, and language.')}
          </p>
        </div>

        {/* Appearance & Theme Card */}
        <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/40 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface">
                {t('staffSettings.appearance', 'Appearance & Theme')}
              </h2>
              <p className="text-xs text-on-surface-variant">
                {t('staffSettings.appearanceDesc', 'Choose your preferred color theme for the staff interface.')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            {themeOptions.map((opt) => {
              const isSelected = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between relative ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                      : 'border-outline-variant/50 bg-surface-container-lowest hover:bg-surface-container-high'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-3">
                    <div className="p-2 rounded-lg bg-surface-container-high">{opt.icon}</div>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-on-surface">{opt.title}</h3>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Language & Regional Card */}
        <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/40 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface">
                {t('staffSettings.languageSection', 'Language & Region')}
              </h2>
              <p className="text-xs text-on-surface-variant">
                {t('staffSettings.languageSectionDesc', 'Select your display language.')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <button
              type="button"
              onClick={() => i18n.changeLanguage('vi')}
              className={`text-left p-4 rounded-xl border transition-all flex items-center justify-between ${
                isVi
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                  : 'border-outline-variant/50 bg-surface-container-lowest hover:bg-surface-container-high'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-6 rounded overflow-hidden shadow-sm shrink-0 flex items-center justify-center border border-outline-variant/30">
                  <VietnamFlag className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Tiếng Việt</h3>
                  <p className="text-xs text-on-surface-variant">Giao diện tiếng Việt chuẩn</p>
                </div>
              </div>
              {isVi && (
                <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => i18n.changeLanguage('en')}
              className={`text-left p-4 rounded-xl border transition-all flex items-center justify-between ${
                !isVi
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                  : 'border-outline-variant/50 bg-surface-container-lowest hover:bg-surface-container-high'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-6 rounded overflow-hidden shadow-sm shrink-0 flex items-center justify-center bg-blue-600/10 text-blue-600 border border-outline-variant/30 font-bold text-xs">
                  EN
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">English</h3>
                  <p className="text-xs text-on-surface-variant">Standard English interface</p>
                </div>
              </div>
              {!isVi && (
                <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
              )}
            </button>
          </div>
        </section>

        {/* Profile & Security Card */}
        <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/40 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-on-surface">
              {t('staffSettings.profileSection', 'Profile & Security')}
            </h2>
            <p className="text-xs text-on-surface-variant">
              {t('staffSettings.profileSectionDesc', 'Manage your staff profile details and login credentials.')}
            </p>
          </div>
          <ProfileSettingsContent />
        </section>
      </div>
    </StaffLayout>
  );
};

