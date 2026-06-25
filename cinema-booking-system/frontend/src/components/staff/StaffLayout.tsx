import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Ticket, TrendingUp, Users } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';

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
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md shadow-sm h-16 flex justify-between items-center px-4 md:px-8">
        <div className="flex items-center gap-8">
          <span 
            className="text-xl font-bold tracking-tighter text-slate-900 cursor-pointer" 
            onClick={() => navigate('/staff/dashboard')}
          >
            CinemaArchitect - Staff
          </span>
          <div className="hidden md:flex space-x-6">
            <button 
              onClick={() => navigate('/staff/dashboard')} 
              className={`transition-colors font-medium text-sm ${activeItemId === 'dashboard' ? 'text-primary font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => navigate('/staff/bookings/new')} 
              className={`transition-colors font-medium text-sm ${activeItemId === 'counter-booking' ? 'text-primary font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Counter Booking
            </button>
            <button 
              onClick={() => navigate('/staff/ticket-lookup')} 
              className={`transition-colors font-medium text-sm ${activeItemId === 'validation' ? 'text-primary font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Ticket Lookup
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600 hidden sm:block">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="bg-error text-white px-3 py-2 rounded-lg font-semibold text-sm hover:bg-red-700 transition-all flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Logout</span>
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
      <footer className="md:hidden fixed bottom-0 w-full bg-white/80 backdrop-blur-md flex justify-around items-center h-16 z-50 border-t border-slate-200">
        <button 
          onClick={() => navigate('/staff/dashboard')} 
          className={`flex flex-col items-center text-center ${activeItemId === 'dashboard' ? 'text-primary' : 'text-slate-500 hover:text-primary'}`}
        >
          <TrendingUp className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter mt-1">Dashboard</span>
        </button>
        <button 
          onClick={() => navigate('/staff/bookings/new')} 
          className={`flex flex-col items-center text-center ${activeItemId === 'counter-booking' ? 'text-primary' : 'text-slate-500 hover:text-primary'}`}
        >
          <Ticket className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter mt-1">Booking</span>
        </button>
        <button 
          onClick={() => navigate('/staff/ticket-lookup')} 
          className={`flex flex-col items-center text-center ${activeItemId === 'validation' ? 'text-primary' : 'text-slate-500 hover:text-primary'}`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter mt-1">Lookup</span>
        </button>
      </footer>
    </div>
  );
};
