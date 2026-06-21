import React from 'react';
import { Bell, HelpCircle, Search, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface AdminTopBarLink {
  label: string;
  to: string;
}

interface AdminTopBarProps {
  title: string;
  navLinks?: AdminTopBarLink[];
  searchPlaceholder?: string;
  actions?: React.ReactNode;
}

export const AdminTopBar: React.FC<AdminTopBarProps> = ({
  title,
  navLinks = [],
  searchPlaceholder = 'Search...',
  actions,
}) => {
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="flex items-center gap-6 flex-1 min-w-[260px]">
        <span className="text-lg font-semibold text-slate-900">{title}</span>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            className="w-full bg-surface-container-low border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/40"
            placeholder={searchPlaceholder}
            type="text"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        {navLinks.length > 0 && (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  isActive
                    ? 'text-blue-700 border-b-2 border-blue-700 pb-1'
                    : 'text-slate-500 hover:text-slate-900'
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}
        {actions}
        <div className="flex items-center gap-4 border-l border-slate-200 pl-6">
          <button className="text-slate-500 hover:text-primary transition-all">
            <Bell className="w-5 h-5" />
          </button>
          <button className="text-slate-500 hover:text-primary transition-all">
            <HelpCircle className="w-5 h-5" />
          </button>
          <button className="text-slate-500 hover:text-primary transition-all">
            <User className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
