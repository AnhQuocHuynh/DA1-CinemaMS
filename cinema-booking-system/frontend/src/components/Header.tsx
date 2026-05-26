import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Settings, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await authService.logout();
    logout();
    setIsMenuOpen(false);
    navigate('/');
  };

  return (
    <nav className="fixed top-0 w-full z-50 glass-header shadow-sm h-16 flex justify-between items-center px-8 transition-all duration-200 ease-in-out bg-white/80 backdrop-blur-md">
      <div className="flex items-center gap-8">
        <span className="text-xl font-bold tracking-tighter text-slate-900">CinemaArchitect</span>
        <div className="hidden md:flex space-x-6">
          <Link to="/" className="text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm">
            Movies
          </Link>
          <Link to="/theaters" className="text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm">
            Theaters
          </Link>
          <Link to="/membership" className="text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm">
            Membership
          </Link>
          {user && (
            <Link
              to="/my-tickets"
              className="text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm"
            >
              My Tickets
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {user ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-all"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
            >
              <User className="w-5 h-5" />
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg bg-white shadow-lg border border-slate-200 overflow-hidden">
                <Link
                  to="/user/settings"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link
              to="/login"
              className="text-slate-600 font-medium text-sm hover:bg-slate-100/50 px-3 py-2 rounded-md transition-all active:scale-95"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="bg-primary text-white px-5 py-2 rounded-lg font-semibold text-sm transition-all active:scale-95 hover:bg-blue-700"
            >
              Book Now
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};
