import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Film, Search, Star } from 'lucide-react';
import { calculateEndTime, formatDuration, searchMovies } from '../utils/movieData';
import { useMovies } from '../hooks/useMovies';
import genericPoster from '../resources/generic_movie_poster.png'

export const MovieSearch: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';

  const { backendMovies, isLoading } = useMovies();

  // Mock results
  const mockResults = useMemo(() => searchMovies(query), [query]);

  // Backend results filtered by query
  const backendResults = useMemo(() => {
    if (!query.trim()) return backendMovies;
    const q = query.toLowerCase();
    return backendMovies.filter((m) => {
      const searchable = [m.title, m.description, m.language, ...m.genres].join(' ').toLowerCase();
      return searchable.includes(q);
    });
  }, [query, backendMovies]);

  const totalCount = backendResults.length + mockResults.length;

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
              Showing {totalCount} results for <span className="font-semibold text-blue-700">"{query || 'all movies'}"</span>
            </p>
          </div>
          {/* <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-600">
            <Search size={16} /> Grid view
          </div> */}
        </div>

        {totalCount === 0 && !isLoading ? (
          <section className="rounded-2xl border border-dashed border-slate-300 p-16 text-center bg-white">
            <Search className="mx-auto text-slate-300" size={44} />
            <h2 className="mt-4 text-xl font-bold">No exact movies found</h2>
            <p className="text-sm text-slate-500 mt-2">Try another keyword like genre, theater, or movie name.</p>
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

            {/* ── Backend results ─────────────────────────────────────── */}
            {backendResults.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Film size={16} className="text-blue-600" />
                  <span className="text-xs font-bold tracking-widest uppercase text-blue-600">From Cinema</span>
                </div>
                <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
                  {backendResults.map((movie) => (
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
                        <p className="text-xs text-slate-500">{movie.genres.join(', ')} – {formatDuration(movie.durationMinutes)}</p>
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

            {/* ── Mock results (TODO: remove when backend is complete) ── */}
            {mockResults.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Star size={16} className="text-amber-500" />
                  <span className="text-xs font-bold tracking-widest uppercase text-amber-600">Featured Showcase</span>
                  <span className="text-[10px] text-slate-400 ml-2">(mock data – remove later)</span>
                </div>
                <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {mockResults.map((movie) => {
                    const firstShow = movie.showtimes[0];
                    const endTime = calculateEndTime(firstShow.startTime, movie.durationMinutes);
                    return (
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
                          <p className="text-sm text-slate-600">
                            {firstShow.startTime} - {endTime}
                          </p>
                          <p className="text-sm text-slate-600">{firstShow.theaterName}</p>
                          <div className="pt-2 flex items-center justify-between">
                            <p className="font-black text-lg">${firstShow.price.toFixed(2)}</p>
                            <Link to={`/movies/${movie.id}`} className="text-sm font-semibold text-blue-700 hover:underline">
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
