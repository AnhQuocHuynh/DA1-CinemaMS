import React from 'react';
import { Bell, Search, User } from 'lucide-react';

interface StaffTopBarProps {
  searchPlaceholder?: string;
}

export const StaffTopBar: React.FC<StaffTopBarProps> = ({
  searchPlaceholder = 'Search Booking ID or Customer...',
}) => {
  return (
    <header className="sticky top-0 right-0 z-30 flex justify-between items-center px-6 md:px-8 h-16 w-full bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="flex items-center flex-1">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            className="w-full bg-surface-container-highest border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary focus:bg-white transition-all"
            placeholder={searchPlaceholder}
            type="text"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="text-slate-500 hover:text-primary transition-all">
          <Bell className="w-5 h-5" />
        </button>
        <button className="text-slate-500 hover:text-primary transition-all">
          <User className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
