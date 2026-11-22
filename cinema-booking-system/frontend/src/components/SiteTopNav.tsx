import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, Menu, Search, User, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { NotificationBell } from './NotificationBell';
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
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
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
    setIsMobileDrawerOpen(false);
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
    setIsMobileSearchOpen(false);
  };

  const navItems = [
    { id: 'Movies', label: t('common.movies'), to: '/' },
    { id: 'Theaters', label: t('common.theaters'), to: '/theaters' },
    { id: 'Membership', label: t('common.membership'), to: '/membership' },
    { id: 'Room Rental', label: t('common.roomRental', 'Room Rental'), to: '/room-rental' },
    ...(user ? [
      { id: 'My Tickets', label: t('common.myTickets'), to: '/my-tickets' },
      { id: 'My Ratings', label: t('common.myRatings', 'My ratings'), to: '/my-ratings' },
    ] : []),
  ];

  return (
    <>
    <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/80 backdrop-blur-md shadow-sm pt-safe">
      <div className="max-w-[1280px] mx-auto h-16 px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-5 min-w-0">
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            className="lg:hidden w-10 h-10 -ml-1 flex items-center justify-center rounded-lg text-on-surface hover:bg-surface-container shrink-0"
            aria-label={t('common.openMenu', 'Open menu')}
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link to="/" className="text-lg sm:text-xl font-bold tracking-tight whitespace-nowrap shrink-0 text-on-surface">
            CinemaArchitect
          </Link>
          <nav className="hidden lg:flex items-center text-sm font-medium">
            {navItems.map((item) => (
              <div key={item.id} className="px-2 xl:px-3 flex justify-center whitespace-nowrap">
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

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {showSearch && (
            <>
              <button
                type="button"
                onClick={() => setIsMobileSearchOpen(true)}
                className="xl:hidden w-10 h-10 flex items-center justify-center rounded-full bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
                aria-label={t('common.search', 'Search')}
              >
                <Search size={18} />
              </button>
              <div className="relative hidden xl:block">
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
            </>
          )}

          <div className="hidden sm:flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <NotificationBell />

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
                    className="block px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-high transition-colors"
                  >
                    {t('common.accountSettings')}
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm text-error hover:bg-error-container hover:text-on-error-container transition-colors flex items-center gap-2"
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
                className="px-3 py-2 sm:px-4 text-xs sm:text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-md sm:min-w-[100px] text-center inline-flex items-center justify-center min-h-[40px] whitespace-nowrap"
              >
                {t('common.signIn')}
              </Link>
              <Link
                to="/signup"
                className="hidden sm:inline-flex items-center justify-center flex-none px-5 py-2 rounded-md bg-primary text-on-primary text-sm font-semibold hover:opacity-90 min-w-[110px] min-h-[40px] text-center whitespace-nowrap"
              >
                {t('common.bookNow')}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>

    {/* Mobile Search Overlay (< xl) */}
    {showSearch && isMobileSearchOpen && (
      <div className="xl:hidden fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileSearchOpen(false)}>
        <div
          className="bg-surface-container-lowest border-b border-outline-variant p-3 pt-safe shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(currentSearch);
            }}
            className="flex items-center gap-2"
          >
            <div className="flex-1 flex items-center gap-2 bg-surface-container border border-outline-variant rounded-xl px-3 min-h-[44px]">
              <Search size={18} className="text-on-surface-variant shrink-0" />
              <input
                autoFocus
                value={currentSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t('common.searchPlaceholder')}
                className="bg-transparent outline-none text-base w-full text-on-surface"
              />
            </div>
            <button
              type="submit"
              className="px-4 min-h-[44px] rounded-xl bg-primary text-on-primary text-sm font-semibold shrink-0"
            >
              {t('common.search')}
            </button>
            <button
              type="button"
              onClick={() => setIsMobileSearchOpen(false)}
              className="w-11 h-11 flex items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container shrink-0"
              aria-label={t('common.close', 'Close')}
            >
              <X size={20} />
            </button>
          </form>

          {suggestions.length > 0 && currentSearch.trim().length > 0 && (
            <div className="mt-3 max-h-[60dvh] overflow-y-auto divide-y divide-outline-variant/40 rounded-xl border border-outline-variant bg-surface-container-lowest">
              {suggestions.map((suggestion) => (
                <button
                  key={`mobile-${suggestion.type}-${suggestion.id}`}
                  type="button"
                  onClick={() => {
                    navigate(suggestion.url);
                    setIsMobileSearchOpen(false);
                  }}
                  className="w-full px-3 py-2.5 text-left hover:bg-surface-container flex items-center gap-3"
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
                    <p className="text-sm font-medium truncate text-on-surface">{suggestion.title}</p>
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
      </div>
    )}

    {/* Mobile Navigation Drawer (< lg) */}
    {isMobileDrawerOpen && (
      <div className="lg:hidden fixed inset-0 z-[58] flex" onClick={() => setIsMobileDrawerOpen(false)}>
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        <aside
          className="relative w-72 max-w-[85vw] h-full bg-surface-container-lowest border-r border-outline-variant p-4 pt-safe pb-safe flex flex-col justify-between overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
              <span className="text-lg font-bold tracking-tight text-on-surface">CinemaArchitect</span>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container"
                aria-label={t('common.closeMenu', 'Close menu')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={`drawer-${item.id}`}
                  to={item.to}
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className={`px-3 py-3 rounded-xl text-sm font-medium transition-colors min-h-[44px] flex items-center ${
                    item.id === activeLabel
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="pt-4 border-t border-outline-variant/60 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  {t('common.preferences', 'Preferences')}
                </span>
                <div className="flex items-center gap-2">
                  <LanguageSwitcher />
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-outline-variant/60 space-y-2">
            {user ? (
              <>
                <Link
                  to="/user/settings"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container text-sm font-medium text-on-surface flex items-center justify-center min-h-[44px]"
                >
                  {t('common.accountSettings')}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm font-semibold flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <LogOut className="w-4 h-4" />
                  {t('common.signOut')}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface flex items-center justify-center min-h-[44px]"
                >
                  {t('common.signIn')}
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="w-full px-4 py-3 rounded-xl bg-primary text-on-primary text-sm font-semibold flex items-center justify-center min-h-[44px]"
                >
                  {t('common.bookNow')}
                </Link>
              </>
            )}
          </div>
        </aside>
      </div>
    )}
    </>
  );
};
