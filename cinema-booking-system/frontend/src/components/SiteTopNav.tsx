import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, Search, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { LanguageSwitcher } from './LanguageSwitcher';
import genericPoster from '../resources/generic_movie_poster.png';

interface SearchSuggestion {
  id: string | number;
  title: string;
  genre?: string;
  type: 'movie' | 'event';
  imageUrl?: string;
  url: string;
}

interface SiteTopNavProps {
  activeLabel?: string;
  showSearch?: boolean;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  onSearchSubmit?: (query: string) => void;
  suggestions?: SearchSuggestion[];
}

export const SiteTopNav: React.FC<SiteTopNavProps> = ({
  activeLabel,
  showSearch = false,
  searchTerm,
  onSearchTermChange,
  onSearchSubmit,
  suggestions = [],
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [internalSearch, setInternalSearch] = useState('');

  const currentSearch = searchTerm ?? internalSearch;

  const visibleSuggestions = useMemo(() => {
    if (!showAutocomplete || suggestions.length === 0) {
      return [];
    }
    return suggestions;
  }, [showAutocomplete, suggestions]);

  const handleLogout = async () => {
    await authService.logout();
    logout();
    setIsMenuOpen(false);
    navigate('/');
  };

  const handleSearchChange = (value: string) => {
    if (onSearchTermChange) {
      onSearchTermChange(value);
    } else {
      setInternalSearch(value);
    }
  };

  const handleSubmit = (query: string) => {
    if (onSearchSubmit) {
      onSearchSubmit(query);
    }
    setShowAutocomplete(false);
  };

  const navItems = [
    { id: 'Movies', label: t('common.movies'), to: '/' },
    { id: 'Theaters', label: t('common.theaters'), to: '/theaters' },
    { id: 'Membership', label: t('common.membership'), to: '/membership' },
    ...(user ? [{ id: 'My Tickets', label: t('common.myTickets'), to: '/my-tickets' }] : []),
  ];

  return (
    <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/80 backdrop-blur-md shadow-sm">
      <div className="max-w-[1280px] mx-auto h-16 px-1 md:px-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <span className="text-xl font-bold tracking-tight">CinemaArchitect</span>
          <nav className="hidden md:flex items-center text-sm font-medium">
            {navItems.map((item) => (
              <div key={item.id} className="w-[110px] flex justify-center">
                <Link
                  to={item.to}
                  className={
                    item.id === activeLabel
                      ? 'text-primary border-b-2 border-blue-700 pb-1'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }
                >
                  {item.label}
                </Link>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {showSearch && (
            <div className="relative hidden lg:block">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit(currentSearch);
                }}
                className="flex items-center gap-2 bg-surface-container border border-outline-variant rounded-lg px-3 py-2"
              >
                <Search size={16} className="text-on-surface-variant" />
                <input
                  value={currentSearch}
                  onFocus={() => setShowAutocomplete(true)}
                  onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={t('common.searchPlaceholder')}
                  className="bg-transparent outline-none text-sm w-52"
                />
                <button type="submit" className="text-xs font-semibold text-primary">
                  {t('common.search')}
                </button>
              </form>

              {visibleSuggestions.length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-surface-container-lowest border border-outline-variant rounded-lg shadow-xl overflow-hidden">
                  {visibleSuggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.type}-${suggestion.id}`}
                      onMouseDown={() => {
                        navigate(suggestion.url);
                        setShowAutocomplete(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-surface-container flex items-center gap-3"
                    >
                      <div className="w-10 h-14 bg-surface-container-high flex-shrink-0 rounded overflow-hidden">
                        <img
                          src={suggestion.imageUrl || genericPoster}
                          alt={suggestion.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = genericPoster;
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{suggestion.title}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${suggestion.type === 'movie' ? 'bg-highlight text-highlight-foreground' : 'bg-amber-100 text-amber-700'
                            }`}>
                            {suggestion.type === 'movie' ? t('common.movies') : t('common.events')}
                          </span>
                          {suggestion.genre && <span className="text-xs text-on-surface-variant truncate">{suggestion.genre}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <LanguageSwitcher />

          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen((open) => !open)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all"
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
              >
                <User className="w-5 h-5" />
              </button>
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg bg-surface-container-lowest shadow-lg border border-outline-variant overflow-hidden">
                  <Link
                    to="/user/settings"
                    onClick={() => setIsMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-on-surface hover:bg-surface-container-high transition-colors"
                  >
                    {t('common.accountSettings')}
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-error hover:bg-error-container hover:text-on-error-container transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    {t('common.signOut')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-md min-w-[100px] text-center inline-block"
              >
                {t('common.signIn')}
              </Link>
              <Link
                to="/signup"
                className="flex-none px-5 py-2 rounded-md bg-primary text-on-primary text-sm font-semibold hover:opacity-90 min-w-[110px] text-center inline-block"
              >
                {t('common.bookNow')}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
