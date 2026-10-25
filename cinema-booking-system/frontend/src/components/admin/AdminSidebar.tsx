import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

const getNavItems = (t: (key: string) => string) => [
  { id: 'dashboard', label: t('adminSidebar.dashboard'), icon: BarChart3, to: '/admin/dashboard' },
  { id: 'movies', label: t('adminSidebar.movies'), icon: Film, to: '/admin/movies' },
  { id: 'events', label: t('adminSidebar.events'), icon: Film, to: '/admin/events' },
  { id: 'showtimes', label: t('adminSidebar.showtimes'), icon: MonitorPlay, to: '/admin/showtimes' },
  { id: 'theaters_and_rooms', label: t('adminSidebar.theatersAndRooms'), icon: LayoutGrid, to: '/admin/rooms' },
  { id: 'pricing', label: t('adminSidebar.vouchers'), icon: Ticket, to: '/admin/pricing' },
  { id: 'permissions', label: t('adminSidebar.permissions'), icon: Users, to: '/admin/permissions' },
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
  const { t } = useTranslation();
  const navItems = getNavItems(t);

  return (
    <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-container-low font-inter text-sm font-medium border-r border-outline-variant z-40">
      <div className="px-6 py-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-accent flex items-center justify-center text-white">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-black text-on-surface">{t('adminSidebar.title')}</div>
            <div className="text-xs text-on-surface-variant">{t('adminSidebar.subtitle')}</div>
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
                  ? 'bg-highlight text-accent border-r-4 border-accent'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
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
        <div className="border-t border-outline-variant pt-4">
          <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-3">{t('adminSidebar.settings')}</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={onSettings}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-on-surface-variant hover:bg-surface-container-high"
            >
              <Settings className="w-4 h-4" />
              {t('adminSidebar.settings')}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-on-surface-variant hover:bg-surface-container-high"
            >
              <LogOut className="w-4 h-4" />
              {t('adminSidebar.logout')}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
