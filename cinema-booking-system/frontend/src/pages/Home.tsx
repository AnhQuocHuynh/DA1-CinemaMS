import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Star, Film } from 'lucide-react';
import { calculateEndTime, formatDuration, movies as mockMovies, searchMovies } from '../utils/movieData';
import { SiteTopNav } from '../components/SiteTopNav';
import { useMovies } from '../hooks/useMovies';
import { MovieResponse } from '../services/movieService';
import { Movie } from '../types/movie';

// ── Helpers to normalise backend movies into a card-friendly shape ──────────

interface HomeMovieCard {
  /** Use numeric backend id when available, mock string id otherwise */
  id: string | number;
  title: string;
  genre: string;
  durationMinutes: number;
  rating: number;
  posterUrl: string;
  backdropUrl: string;
  /** If a backend movie, the first showtime label is built from release date */
  firstShowLabel: string;
  theaterName: string;
  priceLabel: string;
  /** true = came from the backend API */
  isBackend: boolean;
}

function backendToCard(m: MovieResponse): HomeMovieCard {
  return {
    id: m.id,
    title: m.title,
    genre: m.genres.join(', ') || 'Phim',
    durationMinutes: m.durationMinutes,
    rating: 0, // backend doesn't expose rating yet
    posterUrl: m.posterUrl || '',
    backdropUrl: m.posterUrl || '', // reuse poster as backdrop
    firstShowLabel: new Date(m.releaseDate).toLocaleDateString('vi-VN'),
    theaterName: m.active ? 'Đang chiếu' : 'Ngừng chiếu',
    priceLabel: '', // price comes from showtimes, not movie level
    isBackend: true,
  };
}

function mockToCard(m: Movie): HomeMovieCard {
  const firstShow = m.showtimes[0];
  const endTime = calculateEndTime(firstShow.startTime, m.durationMinutes);
  return {
    id: m.id,
    title: m.title,
    genre: m.genre,
    durationMinutes: m.durationMinutes,
    rating: m.rating,
    posterUrl: m.posterUrl,
    backdropUrl: m.backdropUrl,
    firstShowLabel: `${firstShow.startTime} – ${endTime}`,
    theaterName: firstShow.theaterName,
    priceLabel: `$${firstShow.price.toFixed(2)}`,
    isBackend: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch real movies from backend
  const { backendMovies, isLoading: isLoadingBackend } = useMovies();

  // ── Build a unified card list ────────────────────────────────────────────
  // Backend movies first, then mock movies below them.
  // TODO: Remove mockCards once backend data is complete.
  const allCards: HomeMovieCard[] = useMemo(() => {
    const backendCards = backendMovies.map(backendToCard);
    const mockCards = mockMovies.map(mockToCard);
    return [...backendCards, ...mockCards];
  }, [backendMovies]);

  // ── Search suggestions (uses mock util for now, augmented with backend) ──
  const suggestions = useMemo(() => {
    if (!searchTerm.trim()) {
      // Mix backend + mock for dropdown
      const backendSuggestions = backendMovies.map((m) => ({
        id: m.id,
        title: m.title,
        genre: m.genres.join(', '),
      }));
      const mockSuggestions = mockMovies.slice(0, 6).map((m) => ({
        id: m.id,
        title: m.title,
        genre: m.genre,
      }));
      return [...backendSuggestions, ...mockSuggestions].slice(0, 6);
    }
    // For keyword search fall back to existing mock util
    return searchMovies(searchTerm).slice(0, 6);
  }, [searchTerm, backendMovies]);

  const submitSearch = (keyword: string) => {
    const query = keyword.trim();
    navigate(`/movies/search?q=${encodeURIComponent(query)}`);
  };

  // Use the first card's backdrop for the hero (prefer backend)
  const heroCard = allCards[0];

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
        {/* ── Hero ────────────────────────────────────────────────────── */}
        <section className="relative h-[620px] overflow-hidden bg-slate-900">
          {heroCard && (
            <img
              src={heroCard.backdropUrl}
              alt="Hero"
              className="absolute inset-0 h-full w-full object-cover opacity-60"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/60 to-transparent" />

          <div className="relative max-w-[1280px] mx-auto h-full px-6 flex flex-col justify-center">
            <div className="max-w-2xl">
              <span className="inline-block px-3 py-1 rounded-sm bg-blue-600 text-white text-[10px] tracking-[0.2em] uppercase font-bold mb-6">
                Now Premiering
              </span>
              <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight leading-tight mb-6">
                {heroCard?.title ?? 'CinemaArchitect'}
              </h1>
              <p className="text-slate-200 text-lg leading-relaxed mb-8">
                Experience cinema with precision acoustics, immersive projection, and curated comfort in every seat.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                {heroCard && (
                  <Link
                    to={`/movies/${heroCard.id}`}
                    className="px-7 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500"
                  >
                    Explore Featured Movie
                  </Link>
                )}
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

        {/* ── Current Screenings ─────────────────────────────────────── */}
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

          {/* Loading skeleton */}
          {isLoadingBackend && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7 mb-7">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden bg-white border border-slate-200 animate-pulse">
                  <div className="aspect-[2/3] bg-slate-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                    <div className="h-3 bg-slate-100 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Backend movies section ────────────────────────────────── */}
          {backendMovies.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <Film size={16} className="text-blue-600" />
                <span className="text-xs font-bold tracking-widest uppercase text-blue-600">From Cinema</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7 mb-12">
                {backendMovies.map((movie) => {
                  const card = backendToCard(movie);
                  return (
                    <article key={card.id} className="group rounded-xl overflow-hidden bg-white border border-slate-200 hover:shadow-xl transition-shadow">
                      <Link to={`/movies/${card.id}`}>
                        <div className="relative aspect-[2/3] overflow-hidden">
                          {card.posterUrl ? (
                            <img
                              src={card.posterUrl}
                              alt={card.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                              <Film size={48} className="text-slate-400" />
                            </div>
                          )}
                          {movie.active && (
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-green-600 text-white text-[10px] font-bold">
                              Đang chiếu
                            </span>
                          )}
                        </div>
                      </Link>

                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <Link to={`/movies/${card.id}`} className="font-bold leading-tight hover:text-blue-700 transition-colors">
                            {card.title}
                          </Link>
                        </div>

                        <p className="text-xs text-slate-500">{card.genre} – {formatDuration(card.durationMinutes)}</p>
                        <p className="text-sm text-slate-700">{card.firstShowLabel}</p>
                        <p className="text-sm text-slate-600">{card.theaterName}</p>
                        <div className="pt-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-500">{movie.ageRating}</span>
                          <Link to={`/movies/${card.id}`} className="text-sm font-semibold text-blue-700 hover:underline">
                            Chi tiết & Đặt vé
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Mock movies section (remove this block when backend is complete) ── */}
          {/* TODO: REMOVE THIS ENTIRE BLOCK once backend movie data is sufficient */}
          <div className="flex items-center gap-2 mb-4">
            <Star size={16} className="text-amber-500" />
            <span className="text-xs font-bold tracking-widest uppercase text-amber-600">Featured Showcase</span>
            <span className="text-[10px] text-slate-400 ml-2">(mock data – remove later)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7">
            {mockMovies.map((movie) => {
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
          {/* ── END mock movies ─────────────────────────────────────────── */}

        </section>

      </main>
    </div>
  );
};
