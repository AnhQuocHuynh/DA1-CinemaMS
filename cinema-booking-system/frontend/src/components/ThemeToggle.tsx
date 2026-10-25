import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore, Theme } from '../store/themeStore';

export const ThemeToggle: React.FC = () => {
  const { t } = useTranslation();
  const { theme, setTheme } = useThemeStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const themeOptions: { value: Theme; labelKey: string; defaultLabel: string; icon: React.ReactNode }[] = [
    {
      value: 'light',
      labelKey: 'common.themeLight',
      defaultLabel: 'Light',
      icon: <Sun size={16} className="text-amber-500" />,
    },
    {
      value: 'dark',
      labelKey: 'common.themeDark',
      defaultLabel: 'Dark',
      icon: <Moon size={16} className="text-blue-400" />,
    },
    {
      value: 'system',
      labelKey: 'common.themeSystem',
      defaultLabel: 'System',
      icon: <Monitor size={16} className="text-on-surface-variant" />,
    },
  ];

  const currentIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun size={16} className="text-amber-500" />;
      case 'dark':
        return <Moon size={16} className="text-blue-400" />;
      case 'system':
      default:
        return <Monitor size={16} className="text-on-surface-variant" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center gap-1.5 w-9 h-9 shrink-0 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-colors text-on-surface"
        title={t('common.themeToggle', 'Toggle Theme')}
        aria-label={t('common.themeToggle', 'Toggle Theme')}
      >
        <span className="flex items-center justify-center w-4 h-4 shrink-0">
          {currentIcon()}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 rounded-lg bg-surface-container-lowest shadow-lg border border-outline-variant overflow-hidden z-50 py-1">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setTheme(opt.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors ${
                theme === opt.value
                  ? 'bg-primary-container text-primary font-bold'
                  : 'text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span className="flex items-center justify-center w-4 h-4">{opt.icon}</span>
              <span>{t(opt.labelKey, opt.defaultLabel)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
