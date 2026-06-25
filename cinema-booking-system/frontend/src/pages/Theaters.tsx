import React, { useEffect, useState } from 'react';
import { SiteTopNav } from '../components/SiteTopNav';
import { cinemaService, CinemaResponse } from '../services/cinemaService';

export const Theaters: React.FC = () => {
  const [theaters, setTheaters] = useState<CinemaResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadTheaters = async () => {
      try {
        const data = await cinemaService.getCinemas();
        if (isMounted) {
          setTheaters(data);
          setError(null);
        }
      } catch (err) {
        console.error('Failed to load theaters', err);
        if (isMounted) {
          setError('Unable to load theaters right now. Please try again later.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadTheaters();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SiteTopNav activeLabel="Theaters" showSearch={false} />
      <main className="pt-20 px-6 pb-12 max-w-[1200px] mx-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">Theaters (Coming soon)</h1>
          <p className="text-slate-600 mt-2">Find what movie is available for each theaters.</p>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading theaters...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">
            {error}
          </div>
        ) : (
          <section className="grid gap-6 md:grid-cols-2">
            {theaters.map((theater) => (
              <article
                key={theater.id}
                className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{theater.name}</h2>
                    <p className="text-sm text-slate-500">{theater.city}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">
                    {theater.active ? 'Open' : 'Closed'}
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  {theater.address || theater.phone || 'Now showing in multiple formats.'}
                </p>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
};
