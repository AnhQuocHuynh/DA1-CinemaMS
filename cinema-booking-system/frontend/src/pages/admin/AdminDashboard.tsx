import React from 'react';
import { CalendarDays, Filter, Plus } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminTopBar } from '../../components/admin/AdminTopBar';
import { useAdminDashboard } from '../../hooks/useAdminDashboard';

export const AdminDashboard: React.FC = () => {
  const { overview, liveSales, popularMovies, isLoading } = useAdminDashboard();

  return (
    <AdminLayout activeItemId="dashboard">
      <AdminTopBar
        title="Admin Console"
        searchPlaceholder="Search operations, venues, or reports..."
        navLinks={[
          { label: 'Analytics', to: '/admin/dashboard' },
          { label: 'Reports', to: '/admin/permissions' },
          { label: 'Logs', to: '/admin/showtimes' },
        ]}
      />

      <main className="p-6 md:p-10 bg-surface min-h-screen">
        <AdminPageHeader
          eyebrow="Theater Overview"
          title="Good Morning, Chief."
          subtitle="Monday, October 23, 2023"
          actions={
            <>
              <button className="bg-surface-container-low px-4 py-3 rounded-lg flex items-center gap-3 text-sm font-semibold">
                <CalendarDays className="w-4 h-4 text-primary" />
                Last 30 Days
              </button>
              <button className="bg-surface-container-low px-4 py-3 rounded-lg flex items-center gap-3 text-sm font-semibold">
                <Filter className="w-4 h-4 text-primary" />
                Filters
              </button>
            </>
          }
        />

        {isLoading ? (
          <div className="text-center py-16">
            <p className="text-on-surface-variant">Loading dashboard...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-12 gap-6 mt-10">
              <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest rounded-xl p-8 shadow-sm flex flex-col justify-between h-[340px]">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Revenue</span>
                    <h3 className="text-5xl font-black text-primary tracking-tighter mt-2">
                      ${overview?.totalRevenue.toLocaleString('en-US')}
                    </h3>
                    <div className="flex items-center mt-2 text-emerald-600 space-x-1">
                      <span className="text-xs font-bold">{overview?.revenueChange}</span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <span className="w-3 h-3 rounded-full bg-primary"></span>
                    <span className="w-3 h-3 rounded-full bg-primary/20"></span>
                  </div>
                </div>
                <div className="mt-8 flex items-end justify-between h-32 space-x-2">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <div
                      key={`bar-${index}`}
                      className={`w-full rounded-t-sm ${index % 4 === 3 ? 'bg-primary' : 'bg-surface-container-low'}`}
                      style={{ height: `${35 + index * 4}%` }}
                    />
                  ))}
                </div>
              </div>

              <div className="col-span-12 lg:col-span-4 bg-surface-container-lowest rounded-xl p-8 shadow-sm flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-6 w-full text-left">
                  Occupancy Rate
                </span>
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      className="text-surface-container-low"
                      cx="80"
                      cy="80"
                      fill="transparent"
                      r="68"
                      stroke="currentColor"
                      strokeWidth="12"
                    />
                    <circle
                      className="text-primary"
                      cx="80"
                      cy="80"
                      fill="transparent"
                      r="68"
                      stroke="currentColor"
                      strokeDasharray="427.2"
                      strokeDashoffset="110"
                      strokeLinecap="round"
                      strokeWidth="12"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-black text-slate-900 tracking-tighter">
                      {overview?.occupancyRate}%
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Global Average
                    </span>
                  </div>
                </div>
                <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                  <div className="bg-surface-container-low p-3 rounded-lg">
                    <span className="block text-xs font-bold text-slate-900">{overview?.seatsSold}</span>
                    <span className="text-[10px] uppercase text-slate-500 tracking-wider">Seats Sold</span>
                  </div>
                  <div className="bg-surface-container-low p-3 rounded-lg">
                    <span className="block text-xs font-bold text-slate-900">{overview?.seatsAvailable}</span>
                    <span className="text-[10px] uppercase text-slate-500 tracking-wider">Available</span>
                  </div>
                </div>
              </div>

              <div className="col-span-12 lg:col-span-4 bg-inverse-surface rounded-xl p-8 shadow-sm text-white">
                <div className="flex justify-between items-center mb-8">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Live Feed</span>
                  <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                </div>
                <div className="space-y-6">
                  {liveSales.map((sale) => (
                    <div key={sale.id} className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded bg-slate-700/50 flex items-center justify-center overflow-hidden">
                        <img src={sale.posterUrl} alt={sale.movieTitle} className="w-full h-full object-cover opacity-80" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold truncate">{sale.movieTitle}</h4>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                          {sale.tickets} Tickets • {sale.screen}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-primary-fixed-dim">${sale.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <button className="w-full mt-10 py-3 border border-slate-700 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors">
                  View Live Dashboard
                </button>
              </div>

              <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest rounded-xl p-8 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Popularity Index</span>
                  <div className="flex space-x-4">
                    <span className="text-[10px] font-bold uppercase text-primary border-b-2 border-primary pb-1">
                      This Week
                    </span>
                    <span className="text-[10px] font-bold uppercase text-slate-400">All Time</span>
                  </div>
                </div>
                <div className="space-y-6">
                  {popularMovies.map((movie) => (
                    <div key={movie.id} className="group">
                      <div className="flex justify-between items-end mb-2">
                        <h4 className="text-sm font-bold text-slate-900">{movie.title}</h4>
                        <span className="text-xs font-bold text-slate-500">{movie.score}%</span>
                      </div>
                      <div className="h-2 w-full bg-surface-container-low rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${movie.score}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <footer className="mt-12 flex flex-col md:flex-row justify-between items-start md:items-center border-t border-slate-100 pt-8 gap-4">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Projection Systems Online
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Payment Gateway Active
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">v2.4.0 Stable</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">© 2023 The Digital Architect</span>
              </div>
            </footer>

            <button className="fixed bottom-10 right-10 w-14 h-14 bg-primary text-white rounded-full shadow-xl flex items-center justify-center active:scale-95 transition-all z-40">
              <Plus className="w-6 h-6" />
            </button>
          </>
        )}
      </main>
    </AdminLayout>
  );
};
