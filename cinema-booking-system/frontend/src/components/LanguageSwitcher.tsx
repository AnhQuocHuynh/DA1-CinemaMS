import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { VietnamFlag } from "@/components/flags/countries/vn";

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isVi = i18n.language.startsWith('vi');

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

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center gap-1.5 w-[76px] h-9 shrink-0 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-colors text-sm font-semibold text-on-surface"
        title={isVi ? 'Đổi ngôn ngữ' : 'Switch Language'}
      >
        <span className="flex items-center justify-center w-4 h-4 shrink-0">
          {isVi ? <VietnamFlag className="w-full h-full rounded-[2px]" /> : <Globe size={16} />}
        </span>
        <span className="w-[22px] text-center shrink-0">{isVi ? 'VI' : 'EN'}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 rounded-lg bg-surface-container-lowest shadow-lg border border-outline-variant overflow-hidden z-50">
          <button
            onClick={() => changeLanguage('vi')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${isVi ? 'bg-primary-container text-primary font-bold' : 'text-on-surface hover:bg-surface-container-high'
              }`}
          >
            <span className="flex items-center justify-center w-5">
              <VietnamFlag className="w-4 h-3 rounded-sm" />
            </span>
            Tiếng Việt
          </button>
          <button
            onClick={() => changeLanguage('en')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${!isVi ? 'bg-primary-container text-primary font-bold' : 'text-on-surface hover:bg-surface-container-high'
              }`}
          >
            <span className="text-lg flex items-center justify-center w-5"><Globe size={16} /></span>
            English
          </button>
        </div>
      )}
    </div>
  );
};
