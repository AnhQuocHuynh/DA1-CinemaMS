import React from 'react';
import { Link, NavLink } from 'react-router-dom';

interface PortalTopNavProps {
  activeLabel?: string;
}

export const PortalTopNav: React.FC<PortalTopNavProps> = ({ activeLabel }) => {
  const navItems = [
    { label: 'Movies', to: '/' },
    { label: 'Events', to: '/events' },
    { label: 'Theaters', to: '/theaters' },
    { label: 'Support', to: '/support' },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md shadow-sm h-16">
      <div className="flex justify-between items-center px-6 md:px-8 h-full max-w-full mx-auto">
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
          <Link to="/login" className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-md">
            Sign In
          </Link>
          <Link to="/signup" className="px-5 py-2 bg-primary text-white rounded-md text-sm font-semibold">
            Book Now
          </Link>
        </div>
      </div>
    </nav>
  );
};
