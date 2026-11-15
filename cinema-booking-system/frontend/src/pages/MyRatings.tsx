import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Star, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { recommendationService, UserRating } from '../services/recommendationService';
import genericPoster from '../resources/generic_movie_poster.png';

export const MyRatings: React.FC = () => {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<UserRating[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = (nextPage: number) => {
    setIsLoading(true);
    setError('');
    recommendationService.getMyRatingsPage(nextPage, 12)
      .then((result) => {
        setItems(result.items || []);
        setTotalPages(result.totalPages || 0);
        setPage(result.page || 0);
      })
      .catch(() => setError(t('myRatings.loadFailed', 'Could not load your ratings.')))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load(0);
  }, []);

  const remove = async (movieId: number) => {
    await recommendationService.deleteMyRating(movieId);
    load(page);
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="sticky top-0 z-50 bg-surface-container-lowest/90 backdrop-blur border-b border-outline-variant">
        <div className="max-w-[1280px] mx-auto h-16 px-6 flex items-center justify-between">
          <Link to="/" className="font-black tracking-tight text-lg">CinemaArchitect</Link>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface">
            <ArrowLeft size={16} /> {t('myRatings.back', 'Back')}
          </Link>
        </div>
      </header>
      <main className="max-w-[1280px] mx-auto px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{t('myRatings.title', 'Movies I rated')}</h1>
        <p className="text-sm text-on-surface-variant mt-2 mb-8">
          {t('myRatings.subtitle', 'These ratings drive your personal recommendations.')}
        </p>
        {error && <p className="text-sm text-error mb-4">{error}</p>}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="aspect-[2/3] rounded-xl bg-surface-container-high animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-on-surface-variant">{t('myRatings.empty', 'You have not rated a movie yet.')}</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {items.map((item) => (
              <article key={item.ratingId} className="rounded-xl overflow-hidden border border-outline-variant bg-surface-container-lowest">
                <Link to={`/movies/${item.movieId}`}>
                  <img
                    src={item.posterUrl || genericPoster}
                    alt={item.movieTitle}
                    className="aspect-[2/3] w-full object-cover"
                    onError={(event) => {
                      const target = event.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = genericPoster;
                    }}
                  />
                </Link>
                <div className="p-3 space-y-2">
                  <Link to={`/movies/${item.movieId}`} className="font-semibold line-clamp-2 hover:text-primary">
                    {item.movieTitle}
                  </Link>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-amber-500 text-sm font-bold">
                      <Star size={14} className="fill-amber-400" /> {item.ratingValue}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(item.movieId)}
                      className="text-on-surface-variant hover:text-error"
                      aria-label={t('myRatings.delete', 'Delete rating')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center gap-3 mt-8">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => load(page - 1)}
              className="px-3 py-2 rounded-lg border border-outline-variant disabled:opacity-40"
            >
              {t('myRatings.previous', 'Previous')}
            </button>
            <span className="text-sm text-on-surface-variant">{page + 1} / {totalPages}</span>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => load(page + 1)}
              className="px-3 py-2 rounded-lg border border-outline-variant disabled:opacity-40"
            >
              {t('myRatings.next', 'Next')}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
