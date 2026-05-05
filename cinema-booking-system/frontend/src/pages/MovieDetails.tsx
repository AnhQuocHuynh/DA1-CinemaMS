import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, Star } from 'lucide-react';
import { calculateEndTime, formatDuration, getMovieById } from '../utils/movieData';

export const MovieDetails: React.FC = () => {
  const navigate = useNavigate();
  const { movieId } = useParams();
  const movie = movieId ? getMovieById(movieId) : undefined;

  if (!movie) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center px-6">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold">Movie Not Found</h1>
          <p className="text-slate-600">The movie you selected is unavailable.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="fixed top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-black tracking-tight text-lg text-slate-900">CinemaArchitect</Link>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </header>

      <main className="pt-16">
        <section className="relative min-h-[540px] overflow-hidden">
          <img
            src={movie.backdropUrl}
            alt={movie.title}
            className="absolute inset-0 h-full w-full object-cover brightness-[0.45]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-100 via-slate-900/30 to-transparent" />

          <div className="relative max-w-7xl mx-auto px-6 py-20 flex items-end min-h-[540px]">
            <div className="max-w-3xl space-y-6">
              <div className="flex items-center gap-3 text-sm text-white">
                <span className="px-3 py-1 rounded-sm bg-blue-600 font-semibold">Now Showing</span>
                <span className="inline-flex items-center gap-1 text-white">
                  <Star size={15} className="fill-yellow-400 text-yellow-400" /> {movie.rating}
                </span>
                <span className="text-white/70">{movie.genre} - {formatDuration(movie.durationMinutes)}</span>
              </div>

              <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white">{movie.title}</h1>
              <p className="text-white/80 text-lg leading-relaxed">{movie.synopsis}</p>

              <div className="flex flex-wrap gap-3">
                <button className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-colors">
                  <Play size={16} /> Watch Trailer
                </button>
                <button className="px-6 py-3 rounded-lg bg-blue-600 font-semibold hover:bg-blue-500 transition-colors">
                  Book Tickets
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-10">
            <div>
              <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">The Narrative</h2>
              <p className="text-slate-700 leading-relaxed text-lg">{movie.synopsis}</p>
            </div>

            <div>
              <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">The Ensemble</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(movie.cast.length ? movie.cast : [{ name: 'TBA', role: 'Cast update soon', imageUrl: movie.posterUrl }]).map((cast) => (
                  <article key={cast.name} className="rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm">
                    <img src={cast.imageUrl} alt={cast.name} className="w-full aspect-[4/5] object-cover" />
                    <div className="p-4">
                      <p className="font-semibold">{cast.name}</p>
                      <p className="text-sm text-slate-500">{cast.role}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">Release Date</p>
                <p className="font-semibold">{new Date(movie.releaseDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">Language</p>
                <p className="font-semibold">{movie.language}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">Format</p>
                <p className="font-semibold">{[...new Set(movie.showtimes.map((s) => s.format))].join(', ')}</p>
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-xl p-6 space-y-4">
              <h3 className="font-semibold">Today's Showtimes</h3>
              <div className="grid grid-cols-2 gap-2">
                {movie.showtimes.map((show) => (
                  <button
                    key={show.id}
                    className="text-left px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 text-sm"
                  >
                    {show.startTime} - {calculateEndTime(show.startTime, movie.durationMinutes)}
                    <span className="block text-xs text-white/70">{show.format}</span>
                  </button>
                ))}
              </div>
              <button className="w-full py-3 rounded-lg bg-blue-600 font-semibold hover:bg-blue-500 transition-colors">
                Reserve Seat Map
              </button>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
};
