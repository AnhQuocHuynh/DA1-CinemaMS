import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react';
import { calculateEndTime, formatDuration, movies, searchMovies } from '../utils/movieData';
import { SiteTopNav } from '../components/SiteTopNav';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const suggestions = useMemo(() => {
    if (!searchTerm.trim()) {
      return movies.slice(0, 6);
    }
    return searchMovies(searchTerm).slice(0, 6);
  }, [searchTerm]);

  const submitSearch = (keyword: string) => {
    const query = keyword.trim();
    navigate(`/movies/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SiteTopNav
        activeLabel="Movies"
        showSearch
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSearchSubmit={submitSearch}
        suggestions={suggestions}
      />

      <main className="pt-16">
        <section className="relative h-[620px] overflow-hidden bg-slate-900">
          <img
            src={movies[0].backdropUrl}
            alt="Hero"
            className="absolute inset-0 h-full w-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/60 to-transparent" />

          <div className="relative max-w-[1280px] mx-auto h-full px-6 flex flex-col justify-center">
            <div className="max-w-2xl">
              <span className="inline-block px-3 py-1 rounded-sm bg-blue-600 text-white text-[10px] tracking-[0.2em] uppercase font-bold mb-6">
                Now Premiering
              </span>
              <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight leading-tight mb-6">
                The Architect's Vision
              </h1>
              <p className="text-slate-200 text-lg leading-relaxed mb-8">
                Experience cinema with precision acoustics, immersive projection, and curated comfort in every seat.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link to={`/movies/${movies[0].id}`} className="px-7 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500">
                  Explore Featured Movie
                </Link>
                <button
                  onClick={() => submitSearch('')}
                  className="px-7 py-3 rounded-lg bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20"
                >
                  Browse All Movies
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="movies" className="max-w-[1280px] mx-auto px-6 py-12">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Current Screenings</h2>
              <p className="text-slate-600 mt-1">Movies in a grid view with showtime range, theater, and price.</p>
            </div>
            <button onClick={() => submitSearch('')} className="text-sm font-semibold text-blue-700 hover:underline">
              View Full Schedule
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7">
            {movies.map((movie) => {
              const firstShow = movie.showtimes[0];
              const endTime = calculateEndTime(firstShow.startTime, movie.durationMinutes);

              return (
                <article key={movie.id} className="group rounded-xl overflow-hidden bg-white border border-slate-200 hover:shadow-xl transition-shadow">
                  <Link to={`/movies/${movie.id}`}>
                    <div className="relative aspect-[2/3] overflow-hidden">
                      <img
                        src={movie.posterUrl}
                        alt={movie.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  </Link>

                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/movies/${movie.id}`} className="font-bold leading-tight hover:text-blue-700 transition-colors">
                        {movie.title}
                      </Link>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                        <Star size={13} className="fill-amber-400 text-amber-400" /> {movie.rating}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500">{movie.genre} - {formatDuration(movie.durationMinutes)}</p>
                    <p className="text-sm text-slate-700">{firstShow.startTime} - {endTime}</p>
                    <p className="text-sm text-slate-600">{firstShow.theaterName}</p>
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-lg font-black">${firstShow.price.toFixed(2)}</span>
                      <Link to={`/movies/${movie.id}`} className="text-sm font-semibold text-blue-700 hover:underline">
                        Details
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

      </main>
    </div>
  );
};
