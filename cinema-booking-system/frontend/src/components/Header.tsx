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
    <nav className="fixed top-0 w-full z-50 bg-surface-container-lowest/80 backdrop-blur-md shadow-sm h-16 flex justify-between items-center px-8 transition-all duration-200 ease-in-out">
      <div className="flex items-center gap-8">
        <span className="text-xl font-bold tracking-tighter text-on-surface">CinemaArchitect</span>
        <div className="hidden md:flex space-x-6">
          <Link to="/" className="text-on-surface-variant hover:text-on-surface transition-colors font-medium text-sm">
            Movies
          </Link>
          <Link to="/theaters" className="text-on-surface-variant hover:text-on-surface transition-colors font-medium text-sm">
            Theaters
          </Link>
          <Link to="/membership" className="text-on-surface-variant hover:text-on-surface transition-colors font-medium text-sm">
            Membership
          </Link>
          {user && (
            <Link
              to="/my-tickets"
              className="text-on-surface-variant hover:text-on-surface transition-colors font-medium text-sm"
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
                  className="flex items-center gap-2 px-4 py-3 text-sm text-on-surface-variant hover:bg-surface-container"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-on-surface-variant hover:bg-surface-container"
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
              className="text-on-surface-variant font-medium text-sm hover:bg-surface-container/50 px-3 py-2 rounded-md transition-all active:scale-95"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="bg-primary text-on-primary px-5 py-2 rounded-lg font-semibold text-sm transition-all active:scale-95 hover:opacity-90"
            >
              Book Now
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};
