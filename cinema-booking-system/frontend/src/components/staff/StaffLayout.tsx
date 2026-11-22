import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DoorOpen, LogOut, QrCode, Settings, Ticket, TrendingUp, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { ThemeToggle } from '../ThemeToggle';

interface StaffLayoutProps {
  activeItemId?: string;
  children: React.ReactNode;
}

export const StaffLayout: React.FC<StaffLayoutProps> = ({
  activeItemId,
  children,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    console.log('👔 [STAFF] Logout clicked');
    await authService.logout();
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/80 backdrop-blur-md shadow-sm h-16 flex justify-between items-center px-3 sm:px-4 md:px-6 border-b border-outline-variant/30 pt-safe">
        <div className="flex items-center gap-3 md:gap-4 lg:gap-8 min-w-0">
          <span
            className="text-base sm:text-lg lg:text-xl font-bold tracking-tighter text-on-surface cursor-pointer truncate max-w-[150px] sm:max-w-none"
            onClick={() => navigate('/staff/dashboard')}
          >
            {t('staffNav.brand', 'CinemaArchitect - Staff')}
          </span>
          <div className="hidden md:flex space-x-3 lg:space-x-6 whitespace-nowrap">
            <button
              onClick={() => navigate('/staff/dashboard')}
              className={`transition-colors font-medium text-sm ${activeItemId === 'dashboard' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {t('staffNav.dashboard', 'Dashboard')}
            </button>
            <button
              onClick={() => navigate('/staff/qr-checker')}
              className={`transition-colors font-medium text-sm ${activeItemId === 'qr-checker' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {t('staffNav.qrChecker', 'Scan QR')}
            </button>
            <button
              onClick={() => navigate('/staff/bookings/new')}
              className={`transition-colors font-medium text-sm ${activeItemId === 'counter-booking' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {t('staffNav.counterBooking', 'Counter Booking')}
            </button>
            <button
              onClick={() => navigate('/staff/ticket-lookup')}
              className={`transition-colors font-medium text-sm ${activeItemId === 'validation' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {t('staffNav.ticketLookup', 'Ticket Lookup')}
            </button>
            <button
              onClick={() => navigate('/staff/rentals')}
              className={`transition-colors font-medium text-sm ${activeItemId === 'rentals' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {t('staffNav.rentals', 'Room Rentals')}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <LanguageSwitcher />
          <ThemeToggle />

          <button
            type="button"
            onClick={() => navigate('/staff/settings')}
            title={t('staffNav.settings', 'Settings')}
            aria-label={t('staffNav.settings', 'Settings')}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors border ${activeItemId === 'settings'
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high border-transparent'
              }`}
          >
            <Settings className="w-4 h-4" />
          </button>

          <span className="text-sm text-on-surface-variant hidden lg:inline-block max-w-[160px] truncate">{user?.email}</span>

          <button
            onClick={handleLogout}
            className="bg-error text-on-error px-3 py-2 min-h-[40px] rounded-lg font-semibold text-xs sm:text-sm hover:opacity-90 transition-all flex items-center gap-1.5 shrink-0"
            aria-label={t('staffNav.logout', 'Logout')}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('staffNav.logout', 'Logout')}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 md:pt-24 px-3 sm:px-6 md:px-8 pb-24 md:pb-12">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Navigation */}
      <footer className="md:hidden fixed bottom-0 inset-x-0 bg-surface-container-lowest/95 backdrop-blur-md flex justify-around items-stretch min-h-[4rem] h-auto py-1.5 pb-safe z-50 border-t border-outline-variant shadow-lg">
        <button
          onClick={() => navigate('/staff/dashboard')}
          className={`flex-1 min-w-0 flex flex-col items-center justify-center text-center px-1 py-1 ${activeItemId === 'dashboard' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}
        >
          <TrendingUp className="w-5 h-5 shrink-0" />
          <span className="text-[10px] uppercase tracking-tighter mt-1 truncate max-w-full">{t('staffNav.dashboard', 'Dashboard')}</span>
        </button>
        <button
          onClick={() => navigate('/staff/qr-checker')}
          className={`flex-1 min-w-0 flex flex-col items-center justify-center text-center px-1 py-1 ${activeItemId === 'qr-checker' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}
        >
          <QrCode className="w-5 h-5 shrink-0" />
          <span className="text-[10px] uppercase tracking-tighter mt-1 truncate max-w-full">{t('staffNav.qrChecker', 'Scan QR')}</span>
        </button>
        <button
          onClick={() => navigate('/staff/bookings/new')}
          className={`flex-1 min-w-0 flex flex-col items-center justify-center text-center px-1 py-1 ${activeItemId === 'counter-booking' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}
        >
          <Ticket className="w-5 h-5 shrink-0" />
          <span className="text-[10px] uppercase tracking-tighter mt-1 truncate max-w-full">{t('staffNav.counterBooking', 'Booking')}</span>
        </button>
        <button
          onClick={() => navigate('/staff/ticket-lookup')}
          className={`flex-1 min-w-0 flex flex-col items-center justify-center text-center px-1 py-1 ${activeItemId === 'validation' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}
        >
          <Users className="w-5 h-5 shrink-0" />
          <span className="text-[10px] uppercase tracking-tighter mt-1 truncate max-w-full">{t('staffNav.ticketLookup', 'Lookup')}</span>
        </button>
        <button
          onClick={() => navigate('/staff/rentals')}
          className={`flex-1 min-w-0 flex flex-col items-center justify-center text-center px-1 py-1 ${activeItemId === 'rentals' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}
        >
          <DoorOpen className="w-5 h-5 shrink-0" />
          <span className="text-[10px] uppercase tracking-tighter mt-1 truncate max-w-full">{t('staffNav.rentalsShort', 'Rentals')}</span>
        </button>
      </footer>
    </div>
  );
};

