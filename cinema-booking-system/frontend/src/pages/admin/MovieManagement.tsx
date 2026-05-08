import React from 'react';
import { Plus, Search } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminTopBar } from '../../components/admin/AdminTopBar';
import { useAdminMovies } from '../../hooks/useAdminMovies';

export const MovieManagement: React.FC = () => {
  const { movies, isLoading } = useAdminMovies();

  return (
    <AdminLayout activeItemId="movies">
      <AdminTopBar title="Admin Console" searchPlaceholder="Search movies, tags, or status..." />
      <main className="p-6 md:p-10 min-h-screen">
        <AdminPageHeader
          eyebrow="Catalog Control"
          title="Movie Management"
          subtitle="Curate releases, adjust availability, and maintain the lineup."
          actions={
            <button className="px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-blue-700 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Movie
            </button>
          }
        />

        <section className="mt-10 bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/20">
          <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-low/40">
            <div className="flex items-center gap-3 bg-surface-container-highest px-4 py-2 rounded-lg w-full md:w-80">
              <Search className="w-4 h-4 text-outline" />
              <input
                className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-outline"
                placeholder="Search by title or status"
                type="text"
              />
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
              <span>Active</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
              <span>Draft</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
              <span>Archived</span>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-on-surface-variant">Loading movies...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-low/50">
                <tr>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-secondary">Title</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-secondary">Status</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-secondary">Bookings</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-secondary">Rating</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-secondary text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {movies.map((movie) => (
                  <tr key={movie.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4 font-medium text-on-surface">{movie.title}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight ${
                          movie.status === 'active'
                            ? 'bg-green-50 text-green-700'
                            : movie.status === 'draft'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {movie.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface">{movie.bookings}</td>
                    <td className="px-6 py-4 text-sm text-on-surface">{movie.rating ?? '4.7'}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button className="px-3 py-1 bg-primary text-white rounded text-xs hover:bg-blue-700">Edit</button>
                      <button className="px-3 py-1 bg-error text-white rounded text-xs hover:bg-red-700">Archive</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </AdminLayout>
  );
};
