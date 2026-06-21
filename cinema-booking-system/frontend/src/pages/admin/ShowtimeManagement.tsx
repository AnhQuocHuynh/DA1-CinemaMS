import React, { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminTopBar } from '../../components/admin/AdminTopBar';
import { useAdminShowtimes } from '../../hooks/useAdminShowtimes';
import { AdminShowtimeItem } from '../../types/admin';
import genericPoster from '../../resources/generic_movie_poster.png';

export const ShowtimeManagement: React.FC = () => {
  const { showtimes, isLoading } = useAdminShowtimes();
  const [activeEdit, setActiveEdit] = useState<AdminShowtimeItem | null>(null);
  const [isEvent, setIsEvent] = useState(false);

  return (
    <AdminLayout activeItemId="showtimes">
      <AdminTopBar title="Admin Portal" searchPlaceholder="Search schedules..." />
      <main className="p-6 md:p-12 bg-surface min-h-screen">
        <AdminPageHeader
          title="Showtime Management"
          subtitle="Configure schedules and screen allocations for current movie runs."
          actions={
            <button className="bg-primary hover:bg-surface-tint text-on-primary px-6 py-3 rounded shadow-sm transition-all duration-200 active:scale-95 flex items-center gap-2 font-medium">
              <Plus className="w-4 h-4" />
              Add New Showtime
            </button>
          }
        />

        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-10 mb-12">
          <div className="md:col-span-2 bg-surface-container-lowest p-8 rounded-xl border border-transparent shadow-sm flex flex-col justify-between">
            <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-secondary mb-4">Total Screenings Today</label>
            <div className="flex items-end justify-between">
              <span className="text-5xl font-bold tracking-tighter text-on-surface">42</span>
              <span className="text-primary bg-primary/10 px-2 py-1 rounded text-xs font-bold">+12% vs yest.</span>
            </div>
          </div>
          <div className="bg-surface-container-low p-8 rounded-xl flex flex-col justify-between">
            <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-secondary mb-4">Avg. Occupancy</label>
            <span className="text-4xl font-bold tracking-tighter text-on-surface">68%</span>
          </div>
          <div className="bg-surface-container-high p-8 rounded-xl flex flex-col justify-between">
            <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-secondary mb-4">Active Halls</label>
            <span className="text-4xl font-bold tracking-tighter text-on-surface">09</span>
          </div>
        </section>

        <section className="bg-surface-container-lowest rounded-xl overflow-hidden">
          <div className="px-8 py-6 flex items-center justify-between bg-surface-container-low/30">
            <div className="flex items-center gap-4 bg-surface-container-highest px-4 py-2 rounded-lg w-80">
              <Search className="w-4 h-4 text-outline" />
              <input
                className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-outline"
                placeholder="Search movies or halls..."
                type="text"
              />
            </div>
            <div className="flex gap-2">
              <button className="p-2 hover:bg-surface-container-high rounded-lg text-secondary transition-colors">Filter</button>
              <button className="p-2 hover:bg-surface-container-high rounded-lg text-secondary transition-colors">More</button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-on-surface-variant">Loading schedules...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-low/50">
                <tr>
                  <th className="px-8 py-4 text-[10px] uppercase tracking-widest font-bold text-secondary">Movie Title</th>
                  <th className="px-8 py-4 text-[10px] uppercase tracking-widest font-bold text-secondary">Hall</th>
                  <th className="px-8 py-4 text-[10px] uppercase tracking-widest font-bold text-secondary">Date</th>
                  <th className="px-8 py-4 text-[10px] uppercase tracking-widest font-bold text-secondary">Time</th>
                  <th className="px-8 py-4 text-[10px] uppercase tracking-widest font-bold text-secondary text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {showtimes.map((showtime) => (
                  <tr key={showtime.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-14 bg-slate-200 rounded-sm overflow-hidden flex-shrink-0">
                          <img className="w-full h-full object-cover" src={showtime.posterUrl || genericPoster} alt={showtime.movieTitle} onError={(e) => { const target = e.target as HTMLImageElement; target.onerror = null; target.src = genericPoster; }} />
                        </div>
                        <div>
                          <p className="font-medium text-on-surface">{showtime.movieTitle}</p>
                          <p className="text-xs text-secondary">{showtime.genre} • {showtime.duration}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-on-surface">{showtime.hall}</td>
                    <td className="px-8 py-5 text-sm text-secondary">{showtime.date}</td>
                    <td className="px-8 py-5">
                      <span className="px-3 py-1 bg-primary/5 text-primary rounded-full text-xs font-bold">{showtime.time}</span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button
                        className="p-2 text-outline hover:text-primary transition-colors"
                        onClick={() => setActiveEdit(showtime)}
                      >
                        Edit
                      </button>
                      <button className="p-2 text-outline hover:text-error transition-colors">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {activeEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-surface-container-lowest w-full max-w-xl rounded-xl shadow-2xl overflow-hidden">
              <header className="px-8 py-6 border-b border-surface-container flex justify-between items-center">
                <h2 className="text-xl font-bold tracking-tight">Edit Showtime</h2>
                <button className="text-secondary hover:text-on-surface" onClick={() => setActiveEdit(null)}>
                  Close
                </button>
              </header>
              <form className="p-8 space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-secondary">Type</label>
                  <select 
                    value={isEvent ? 'event' : 'movie'} 
                    onChange={(e) => setIsEvent(e.target.value === 'event')}
                    className="bg-surface-container-highest border-0 focus:ring-0 text-sm rounded-lg px-3 py-1.5"
                  >
                    <option value="movie">Movie</option>
                    <option value="event">Event</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-secondary block">{isEvent ? 'Event Title' : 'Movie Title'}</label>
                  <input
                    className="w-full bg-surface-container-highest border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 transition-all px-4 py-3 rounded-t-lg font-medium text-on-surface"
                    type="text"
                    defaultValue={activeEdit.movieTitle}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-secondary block">Theater Hall</label>
                    <input
                      className="w-full bg-surface-container-highest border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 transition-all px-4 py-3 rounded-t-lg font-medium text-on-surface"
                      type="text"
                      defaultValue={activeEdit.hall}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-secondary block">Seat Map Version</label>
                    <select className="w-full bg-surface-container-highest border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 transition-all px-4 py-3 rounded-t-lg font-medium text-on-surface">
                      <option>Standard 120-Seat</option>
                      <option>Premium 80-Seat</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-secondary block">Date</label>
                    <input
                      className="w-full bg-surface-container-highest border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 transition-all px-4 py-3 rounded-t-lg font-medium text-on-surface"
                      type="date"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-secondary block">Start Time</label>
                    <input
                      className="w-full bg-surface-container-highest border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 transition-all px-4 py-3 rounded-t-lg font-medium text-on-surface"
                      type="time"
                    />
                  </div>
                </div>
                <div className="pt-6 flex gap-4 justify-end">
                  <button
                    className="px-6 py-2.5 rounded text-sm font-bold uppercase tracking-widest text-secondary hover:bg-surface-container transition-colors"
                    type="button"
                    onClick={() => setActiveEdit(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-8 py-2.5 rounded bg-primary text-on-primary text-sm font-bold uppercase tracking-widest shadow-md hover:opacity-90 transition-all active:scale-95"
                    type="submit"
                  >
                    Update Showtime
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </AdminLayout>
  );
};
