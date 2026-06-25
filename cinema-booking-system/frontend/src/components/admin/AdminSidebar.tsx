import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  Film,
  LayoutGrid,
  LogOut,
  MonitorPlay,
  Settings,
  Ticket,
  Users,
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, to: '/admin/dashboard' },
  { id: 'movies', label: 'Movies', icon: Film, to: '/admin/movies' },
  { id: 'events', label: 'Events', icon: Film, to: '/admin/events' },
  { id: 'showtimes', label: 'Showtimes', icon: MonitorPlay, to: '/admin/showtimes' },
  { id: 'rooms', label: 'Rooms', icon: LayoutGrid, to: '/admin/rooms' },
  { id: 'pricing', label: 'Pricing & Vouchers', icon: Ticket, to: '/admin/pricing' },
  { id: 'permissions', label: 'Permissions', icon: Users, to: '/admin/permissions' },
];

interface AdminSidebarProps {
  activeItemId?: string;
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
  onSettings?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeItemId,
  onLogout,
  onSettings,
}) => {
  return (
    <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-slate-50 font-inter text-sm font-medium border-r border-slate-200 z-40">
      <div className="px-6 py-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-blue-600 flex items-center justify-center text-white">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-black text-slate-900">Admin Console</div>
            <div className="text-xs text-slate-500">Enterprise Management</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeItemId;
          return (
            <NavLink
              key={item.id}
              to={item.to}
              className={({ isActive: navActive }) =>
                `w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-all duration-200 ease-in-out ${navActive || isActive
                  ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700'
                  : 'text-slate-500 hover:bg-slate-200'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-6 pb-6">
        <div className="border-t border-slate-200 pt-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">Settings</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={onSettings}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-slate-600 hover:bg-slate-200"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-slate-600 hover:bg-slate-200"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
