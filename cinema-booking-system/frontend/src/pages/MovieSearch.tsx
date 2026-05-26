import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { calculateEndTime, searchMovies } from '../utils/movieData';

export const MovieSearch: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';

  const results = useMemo(() => searchMovies(query), [query]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto h-16 px-6 flex items-center justify-between">
          <Link to="/" className="font-black tracking-tight text-lg">CinemaArchitect</Link>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft size={16} /> Back
          </Link>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-6 py-10">
        <div className="flex items-center justify-between gap-6 mb-10 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Search Results</h1>
            <p className="text-sm text-slate-600 mt-1">
              Showing {results.length} results for <span className="font-semibold text-blue-700">"{query || 'all movies'}"</span>
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-600">
            <Search size={16} /> Grid view
          </div>
        </div>

        {results.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 p-16 text-center bg-white">
            <Search className="mx-auto text-slate-300" size={44} />
            <h2 className="mt-4 text-xl font-bold">No exact movies found</h2>
            <p className="text-sm text-slate-500 mt-2">Try another keyword like genre, theater, or movie name.</p>
          </section>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {results.map((movie) => {
              const firstShow = movie.showtimes[0];
              const endTime = calculateEndTime(firstShow.startTime, movie.durationMinutes);
              return (
                <article
                  key={movie.id}
                  className="rounded-xl overflow-hidden bg-white border border-slate-200 hover:shadow-lg transition-shadow"
                >
                  <Link to={`/movies/${movie.id}`}>
                    <img src={movie.posterUrl} alt={movie.title} className="w-full aspect-[2/3] object-cover" />
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
        )}
      </main>
    </div>
  );
};
