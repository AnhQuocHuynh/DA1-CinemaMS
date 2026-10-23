import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, Ticket, TrendingUp, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { ThemeToggle } from '../ThemeToggle';

interface StaffLayoutProps {
  activeItemId?: string;
  children: React.ReactNode;
  searchPlaceholder?: string; // Kept for backwards compatibility but unused
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
      <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/80 backdrop-blur-md shadow-sm h-16 flex justify-between items-center px-4 md:px-8 border-b border-outline-variant/30">
        <div className="flex items-center gap-8">
          <span 
            className="text-xl font-bold tracking-tighter text-on-surface cursor-pointer" 
            onClick={() => navigate('/staff/dashboard')}
          >
            {t('staffNav.brand', 'CinemaArchitect - Staff')}
          </span>
          <div className="hidden md:flex space-x-6">
            <button 
              onClick={() => navigate('/staff/dashboard')} 
              className={`transition-colors font-medium text-sm ${activeItemId === 'dashboard' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {t('staffNav.dashboard', 'Dashboard')}
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
              onClick={() => navigate('/staff/settings')} 
              className={`transition-colors font-medium text-sm ${activeItemId === 'settings' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {t('staffNav.settings', 'Settings')}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <ThemeToggle />

          <button
            type="button"
            onClick={() => navigate('/staff/settings')}
            title={t('staffNav.settings', 'Settings')}
            className={`p-2 rounded-lg transition-colors border ${
              activeItemId === 'settings'
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high border-transparent'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>

          <span className="text-sm text-on-surface-variant hidden lg:inline-block max-w-[160px] truncate">{user?.email}</span>

          <button
            onClick={handleLogout}
            className="bg-error text-on-error px-3 py-1.5 rounded-lg font-semibold text-xs sm:text-sm hover:opacity-90 transition-all flex items-center gap-1.5 shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('staffNav.logout', 'Logout')}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 px-4 md:px-8 pb-20">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Navigation */}
      <footer className="md:hidden fixed bottom-0 w-full bg-surface-container-lowest/80 backdrop-blur-md flex justify-around items-center h-16 z-50 border-t border-outline-variant">
        <button 
          onClick={() => navigate('/staff/dashboard')} 
          className={`flex flex-col items-center text-center ${activeItemId === 'dashboard' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}
        >
          <TrendingUp className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-tighter mt-1">{t('staffNav.dashboard', 'Dashboard')}</span>
        </button>
        <button 
          onClick={() => navigate('/staff/bookings/new')} 
          className={`flex flex-col items-center text-center ${activeItemId === 'counter-booking' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}
        >
          <Ticket className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-tighter mt-1">{t('staffNav.counterBooking', 'Booking')}</span>
        </button>
        <button 
          onClick={() => navigate('/staff/ticket-lookup')} 
          className={`flex flex-col items-center text-center ${activeItemId === 'validation' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-tighter mt-1">{t('staffNav.ticketLookup', 'Lookup')}</span>
        </button>
        <button 
          onClick={() => navigate('/staff/settings')} 
          className={`flex flex-col items-center text-center ${activeItemId === 'settings' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-tighter mt-1">{t('staffNav.settings', 'Settings')}</span>
        </button>
      </footer>
    </div>
  );
};

