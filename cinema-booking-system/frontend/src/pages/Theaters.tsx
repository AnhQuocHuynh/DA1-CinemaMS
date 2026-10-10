import React, { useEffect, useState } from 'react';
import { SiteTopNav } from '../components/SiteTopNav';
import { cinemaService, CinemaResponse } from '../services/cinemaService';
import { useTranslation } from 'react-i18next';

export const Theaters: React.FC = () => {
  const { t } = useTranslation();
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
          setError(t('theaters.errorLoad', 'Unable to load theaters right now. Please try again later.'));
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
    <div className="min-h-screen bg-surface text-on-surface">
      <SiteTopNav activeLabel="Theaters" showSearch={false} />
      <main className="pt-20 px-6 pb-12 max-w-[1200px] mx-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">{t('theaters.title', 'Theaters (Coming soon)')}</h1>
          <p className="text-on-surface-variant mt-2">{t('theaters.description', 'Find what movie is available for each theaters.')}</p>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-sm text-on-surface-variant">
            {t('theaters.loading', 'Loading theaters...')}
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
                className="rounded-2xl bg-surface-container-lowest border border-outline-variant p-6 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-on-surface">{theater.name}</h2>
                    <p className="text-sm text-on-surface-variant">{theater.city}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                    {theater.active ? t('theaters.open', 'Open') : t('theaters.closed', 'Closed')}
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant">
                  {theater.address || theater.phone || t('theaters.defaultDesc', 'Now showing in multiple formats.')}
                </p>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
};
