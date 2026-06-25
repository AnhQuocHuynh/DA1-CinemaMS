import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Settings, User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';

interface PortalTopNavProps {
  activeLabel?: string;
}

export const PortalTopNav: React.FC<PortalTopNavProps> = ({ activeLabel }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await authService.logout();
    logout();
    setIsMenuOpen(false);
    navigate('/');
  };

  const navItems = [
    { label: 'Movies', to: '/' },
    { label: 'Theaters', to: '/theaters' },
    { label: 'Membership', to: '/membership' },
    ...(user ? [{ label: 'My Tickets', to: '/my-tickets' }] : []),
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md shadow-sm h-16">
      <div className="flex justify-between items-center h-16 max-w-[1280px] mx-auto px-1 md:px-2">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tighter text-slate-900">CinemaArchitect</span>
          <div className="hidden md:flex gap-6 items-center text-sm font-medium">
            {navItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  isActive || item.label === activeLabel
                    ? 'text-blue-600 border-b-2 border-blue-600 pb-1'
                    : 'text-slate-600 hover:text-slate-900'
                }
              >
                {item.label}
              </NavLink>
            ))}
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
              <Link to="/login" className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-md">
                Sign In
              </Link>
              <Link to="/signup" className="px-5 py-2 bg-primary text-white rounded-md text-sm font-semibold">
                Book Now
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
