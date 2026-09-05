import React from 'react';
import { NavLink } from 'react-router-dom';
import { Calendar, LayoutGrid, Settings, TicketCheck, TrendingUp, Users } from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', to: '/staff/dashboard', icon: TrendingUp },
  { id: 'counter-booking', label: 'Counter Booking', to: '/staff/bookings/new', icon: TicketCheck },
  { id: 'schedules', label: 'Schedules', to: '/staff/schedules', icon: Calendar },
  { id: 'seat-maps', label: 'Seat Maps', to: '/staff/seat-maps', icon: LayoutGrid },
  { id: 'validation', label: 'Staff', to: '/staff/ticket-lookup', icon: Users },
  { id: 'settings', label: 'Settings', to: '/staff/settings', icon: Settings },
];

interface StaffSidebarProps {
  activeItemId?: string;
}

export const StaffSidebar: React.FC<StaffSidebarProps> = ({ activeItemId }) => {
  return (
    <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant z-40">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight text-on-surface">Cinema Ops</h1>
        <p className="text-xs text-on-surface-variant mt-1 uppercase tracking-wider">Global Admin</p>
      </div>
      <nav className="flex-1 px-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeItemId;
          return (
            <NavLink
              key={item.id}
              to={item.to}
              className={({ isActive: navActive }) =>
                `flex items-center gap-3 px-4 py-3 text-sm transition-colors duration-200 ${
                  navActive || isActive
                    ? 'text-primary font-semibold bg-primary-container/50 border-r-4 border-blue-700'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="p-4 mt-auto border-t border-outline-variant/60">
        <button className="w-full bg-primary text-on-primary py-2.5 rounded hover:opacity-90 transition-all font-medium flex items-center justify-center gap-2">
          <TicketCheck className="w-4 h-4" />
          New Screening
        </button>
      </div>
    </aside>
  );
};
