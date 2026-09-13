import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Calendar, LayoutGrid, Settings, TicketCheck, TrendingUp, Users } from 'lucide-react';

const getNavItems = (t: (key: string) => string) => [
  { id: 'dashboard', label: t('staffSidebar.dashboard'), to: '/staff/dashboard', icon: TrendingUp },
  { id: 'counter-booking', label: t('staffSidebar.counterBooking'), to: '/staff/bookings/new', icon: TicketCheck },
  { id: 'schedules', label: t('staffSidebar.schedules'), to: '/staff/schedules', icon: Calendar },
  { id: 'seat-maps', label: t('staffSidebar.seatMaps'), to: '/staff/seat-maps', icon: LayoutGrid },
  { id: 'validation', label: t('staffSidebar.staff'), to: '/staff/ticket-lookup', icon: Users },
  { id: 'settings', label: t('staffSidebar.settings'), to: '/staff/settings', icon: Settings },
];

interface StaffSidebarProps {
  activeItemId?: string;
}

export const StaffSidebar: React.FC<StaffSidebarProps> = ({ activeItemId }) => {
  const { t } = useTranslation();
  const navItems = getNavItems(t);

  return (
    <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant z-40">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight text-on-surface">{t('staffSidebar.title')}</h1>
        <p className="text-xs text-on-surface-variant mt-1 uppercase tracking-wider">{t('staffSidebar.subtitle')}</p>
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
                    ? 'text-accent font-semibold bg-highlight/50 border-r-4 border-accent'
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
        <button className="w-full bg-primary text-on-primary py-2.5 rounded hover:opacity-90 transition-all font-medium flex items-center justify-center gap-2 mb-4">
          <TicketCheck className="w-4 h-4" />
          {t('staffSidebar.newScreening')}
        </button>
      </div>
    </aside>
  );
};
