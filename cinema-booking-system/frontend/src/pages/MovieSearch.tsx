import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Film, Search, Calendar, MapPin } from 'lucide-react';
import { formatDuration } from '../utils/movieData';
import { catalogService, CatalogSearchResponse } from '../services/catalogService';
import genericPoster from '../resources/generic_movie_poster.png'

export const MovieSearch: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';

  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState<CatalogSearchResponse | null>(null);

  useEffect(() => {
    const fetchSearch = async () => {
      setIsLoading(true);
      try {
        const data = await catalogService.search({ keyword: query, size: 20 });
        setResults(data);
      } catch (error) {
        console.error('Error searching catalog:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSearch();
  }, [query]);

  const backendMovies = results?.movies || [];
  const backendEvents = results?.events || [];
  const totalCount = backendMovies.length + backendEvents.length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto h-16 px-6 flex items-center justify-between">
          <Link to="/" className="font-black tracking-tight text-lg">CinemaArchitect</Link>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft size={16} /> Quay lại
          </Link>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-6 py-10">
        <div className="flex items-center justify-between gap-6 mb-10 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Search Results</h1>
            <p className="text-sm text-slate-600 mt-1">
              Showing {totalCount} results for <span className="font-semibold text-blue-700">"{query || 'all catalogs'}"</span>
            </p>
          </div>
        </div>

        {totalCount === 0 && !isLoading ? (
          <section className="rounded-2xl border border-dashed border-slate-300 p-16 text-center bg-white">
            <Search className="mx-auto text-slate-300" size={44} />
            <h2 className="mt-4 text-xl font-bold">No exact matches found</h2>
            <p className="text-sm text-slate-500 mt-2">Try another keyword like genre, theater, or name.</p>
          </section>
        ) : (
          <>
            {/* Loading skeleton */}
            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl overflow-hidden bg-white border border-slate-200 animate-pulse">
                    <div className="aspect-[2/3] bg-slate-200" />
                    <div className="p-5 space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Movies results ─────────────────────────────────────── */}
            {backendMovies.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Film size={16} className="text-blue-600" />
                  <span className="text-xs font-bold tracking-widest uppercase text-blue-600">Movies</span>
                </div>
                <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
                  {backendMovies.map((movie) => (
                    <article
                      key={movie.id}
                      className="rounded-xl overflow-hidden bg-white border border-slate-200 hover:shadow-lg transition-shadow"
                    >
                      <Link to={`/movies/${movie.id}`}>
                        <img
                          src={movie.posterUrl || genericPoster}
                          alt={movie.title}
                          className="w-full aspect-[2/3] object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = genericPoster;
                          }}
                        />
                      </Link>
                      <div className="p-5 space-y-2">
                        <Link to={`/movies/${movie.id}`} className="block text-lg font-bold hover:text-blue-700 transition-colors">
                          {movie.title}
                        </Link>
                        <p className="text-xs text-slate-500">{(movie.genres || []).join(', ')} – {formatDuration(movie.durationMinutes)}</p>
                        <p className="text-sm text-slate-600">
                          {new Date(movie.releaseDate).toLocaleDateString('vi-VN')}
                        </p>
                        <div className="pt-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-500">{movie.ageRating}</span>
                          <Link to={`/movies/${movie.id}`} className="text-sm font-semibold text-blue-700 hover:underline">
                            Chi tiết & Đặt vé
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </section>
              </>
            )}

            {/* ── Events results ─────────────────────────────────────── */}
            {backendEvents.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar size={16} className="text-amber-500" />
                  <span className="text-xs font-bold tracking-widest uppercase text-amber-600">Events</span>
                </div>
                <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {backendEvents.map((event) => {
                    return (
                      <article
                        key={event.id}
                        className="rounded-xl overflow-hidden bg-white border border-slate-200 hover:shadow-lg transition-shadow"
                      >
                        <Link to={`/events/${event.id}`}>
                          <img
                            src={event.imageUrl || genericPoster}
                            alt={event.name}
                            className="w-full aspect-[2/3] object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src = genericPoster;
                            }}
                          />
                        </Link>
                        <div className="p-5 space-y-2">
                          <Link to={`/events/${event.id}`} className="block text-lg font-bold hover:text-amber-600 transition-colors">
                            {event.name}
                          </Link>
                          <div className="text-sm text-slate-600 flex items-center gap-2">
                            <Calendar size={14} className="text-slate-400" />
                            <span>{new Date(event.startTime).toLocaleDateString('vi-VN')} - {new Date(event.endTime).toLocaleDateString('vi-VN')}</span>
                          </div>
                          <div className="text-sm text-slate-600 flex items-center gap-2">
                            <MapPin size={14} className="text-slate-400" />
                            <span>{event.venue}</span>
                          </div>
                          <div className="pt-2 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500">Sự kiện đặc biệt</span>
                            <Link to={`/events/${event.id}`} className="text-sm font-semibold text-amber-600 hover:underline">
                              View Details
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

