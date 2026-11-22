import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Ticket, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';

const HIDDEN_PREFIXES = [
  '/admin',
  '/staff',
  '/login',
  '/signup',
  '/forgot-password',
  '/auth/callback',
  '/health-check',
  '/user/booking',
  '/user/checkout',
  '/user/booking-failed',
];

export const MobileBottomNav: React.FC = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);

  const isHidden = HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isHidden) {
    return null;
  }

  const tabs = [
    {
      id: 'home',
      label: t('common.home', 'Home'),
      to: '/',
      icon: Home,
      isActive: pathname === '/',
    },
    {
      id: 'search',
      label: t('common.search', 'Search'),
      to: '/movies/search',
      icon: Search,
      isActive: pathname.startsWith('/movies') || pathname.startsWith('/events'),
    },
    {
      id: 'tickets',
      label: t('common.myTickets', 'My Tickets'),
      to: '/my-tickets',
      icon: Ticket,
      isActive: pathname.startsWith('/my-tickets') || pathname.startsWith('/user/tickets'),
    },
    {
      id: 'account',
      label: t('common.account', 'Account'),
      to: user ? '/user/settings' : '/login',
      icon: User,
      isActive: pathname === '/user/settings' || pathname === '/my-ratings',
    },
  ];

  return (
    <nav
      aria-label={t('common.mobileNavigation', 'Mobile Navigation')}
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-surface-container-lowest/95 backdrop-blur-lg border-t border-outline-variant/60 pb-safe shadow-lg"
    >
      <div className="flex items-stretch justify-around h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              to={tab.to}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center transition-colors ${
                tab.isActive
                  ? 'text-primary font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] leading-tight truncate max-w-full">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
