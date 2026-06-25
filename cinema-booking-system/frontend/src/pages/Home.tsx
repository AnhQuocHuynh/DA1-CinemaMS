import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Star, Film, ChevronLeft, ChevronRight } from 'lucide-react';
import { RatingBadge } from '../components/Review/RatingBadge';
import { calculateEndTime, formatDuration, movies as mockMovies } from '../utils/movieData';
import { SiteTopNav } from '../components/SiteTopNav';
import { useMovies } from '../hooks/useMovies';
import { eventService, EventResponse } from '../services/eventService';
import { MovieResponse } from '../services/movieService';
import { catalogService } from '../services/catalogService';
import { Movie } from '../types/movie';
import genericPoster from '../resources/generic_movie_poster.png';

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
    theaterName: !m.active 
      ? 'Ngừng chiếu' 
      : (new Date(m.releaseDate).setHours(0,0,0,0) > new Date().setHours(0,0,0,0) ? 'Sắp chiếu' : 'Đang chiếu'),
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
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [events, setEvents] = useState<EventResponse[]>([]);

  // Fetch real movies from backend
  const { backendMovies, isLoading: isLoadingBackend } = useMovies();

  useEffect(() => {
    eventService.getEvents().then(setEvents).catch(console.error);
  }, []);

  // ── Build a unified card list ────────────────────────────────────────────
  // Backend movies first, then mock movies below them.
  // TODO: Remove mockCards once backend data is complete.
  const allCards: HomeMovieCard[] = useMemo(() => {
    const backendCards = backendMovies.map(backendToCard);
    const mockCards = mockMovies.map(mockToCard);
    return [...backendCards, ...mockCards];
  }, [backendMovies]);

  // ── Search suggestions (uses catalog API) ──
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [suggestions, setSuggestions] = useState<{ id: string | number; title: string; genre?: string; type: 'movie' | 'event'; imageUrl?: string; url: string }[]>([]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    if (!debouncedSearchTerm.trim()) {
      // Show default top movies if empty
      const backendSuggestions = backendMovies.slice(0, 3).map((m) => ({
        id: m.id,
        title: m.title,
        genre: m.genres.join(', '),
        type: 'movie' as const,
        imageUrl: m.posterUrl || '',
        url: `/movies/${m.id}`
      }));
      const mockSuggestions = mockMovies.slice(0, 3).map((m) => ({
        id: m.id,
        title: m.title,
        genre: m.genre,
        type: 'movie' as const,
        imageUrl: m.posterUrl || '',
        url: `/movies/${m.id}`
      }));
      setSuggestions([...backendSuggestions, ...mockSuggestions]);
      return;
    }

    let isSubscribed = true;
    catalogService.search({ keyword: debouncedSearchTerm, size: 4 })
      .then((data) => {
        if (!isSubscribed) return;
        
        const moviesResult = data.movies.map(m => ({
          id: m.id,
          title: m.title,
          genre: m.genres.join(', '),
          type: 'movie' as const,
          imageUrl: m.posterUrl || '',
          url: `/movies/${m.id}`
        }));
        
        const eventsResult = data.events.map(e => ({
          id: e.id,
          title: e.name,
          genre: '',
          type: 'event' as const,
          imageUrl: e.imageUrl || '',
          url: `/events/${e.id}`
        }));
        
        setSuggestions([...moviesResult, ...eventsResult].slice(0, 5));
      })
      .catch(console.error);

    return () => { isSubscribed = false; };
  }, [debouncedSearchTerm, backendMovies]);

  const submitSearch = (keyword: string) => {
    const query = keyword.trim();
    navigate(`/movies/search?q=${encodeURIComponent(query)}`);
  };

  // ── Hero Movies ──────────────────────────────────────────────────────────
  const heroMovies = allCards.slice(0, 5);
  const heroCard = heroMovies[currentHeroIndex] || allCards[0];

  const handlePrevHero = () => {
    setCurrentHeroIndex((prev) => (prev === 0 ? Math.max(0, heroMovies.length - 1) : prev - 1));
  };

  const handleNextHero = () => {
    setCurrentHeroIndex((prev) => (prev === heroMovies.length - 1 ? 0 : prev + 1));
  };

  // Auto-scroll hero carousel
  useEffect(() => {
    if (heroMovies.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentHeroIndex((prev) => (prev === heroMovies.length - 1 ? 0 : prev + 1));
    }, 5000);
    return () => clearInterval(timer);
  }, [heroMovies.length, currentHeroIndex]);

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
              key={heroCard.id}
              src={heroCard.backdropUrl || genericPoster}
              alt="Hero"
              className="absolute inset-0 h-full w-full object-cover opacity-50 transition-opacity duration-700"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.onerror = null;
                target.src = genericPoster;
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent" />

          <div className="relative max-w-[1280px] mx-auto h-full px-6 flex items-center justify-between gap-8 xl:gap-12">
            <div className="max-w-xl flex-shrink-0">
              <span className="inline-block px-3 py-1 rounded-sm bg-blue-600 text-white text-[10px] tracking-[0.2em] uppercase font-bold mb-6">
                Now Premiering
              </span>
              <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight leading-tight mb-6 line-clamp-2">
                {heroCard?.title ?? 'CinemaArchitect'}
              </h1>
              <p className="text-slate-200 text-lg leading-relaxed mb-8 line-clamp-3">
                Experience cinema with precision acoustics, immersive projection, and curated comfort in every seat.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                {heroCard && (
                  <Link
                    to={`/movies/${heroCard.id}`}
                    className="px-7 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors"
                  >
                    Explore Featured Movie
                  </Link>
                )}
                <button
                  onClick={() => submitSearch('')}
                  className="px-7 py-3 rounded-lg bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 transition-colors"
                >
                  Browse All Movies
                </button>
              </div>
            </div>

            {/* Carousel Posters (hidden on small screens) */}
            {heroMovies.length > 0 && (
              <div className="hidden lg:flex items-center gap-2 xl:gap-4 relative z-10 mt-12">
                <button
                  onClick={handlePrevHero}
                  className="p-2 rounded-full bg-black/40 text-white hover:bg-blue-600 transition-colors backdrop-blur-sm border border-white/10 flex-shrink-0"
                >
                  <ChevronLeft size={24} />
                </button>

                <div className="flex items-center gap-2 xl:gap-4">
                  {heroMovies.map((m, idx) => {
                    const isActive = idx === currentHeroIndex;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setCurrentHeroIndex(idx)}
                        className={`relative rounded-xl overflow-hidden transition-all duration-300 flex-shrink-0 ${isActive
                            ? 'w-28 xl:w-36 aspect-[2/3] border-2 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)] scale-105 z-10'
                            : 'w-16 xl:w-24 aspect-[2/3] border border-white/20 opacity-50 hover:opacity-100'
                          }`}
                      >
                        <img
                          src={m.posterUrl || genericPoster}
                          alt={m.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = genericPoster;
                          }}
                        />
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={handleNextHero}
                  className="p-2 rounded-full bg-black/40 text-white hover:bg-blue-600 transition-colors backdrop-blur-sm border border-white/10"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            )}
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
                          <img
                            src={card.posterUrl || genericPoster}
                            alt={card.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src = genericPoster;
                            }}
                          />
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
                          <RatingBadge type="movie" id={movie.id} />
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
                        src={movie.posterUrl || genericPoster}
                        alt={movie.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = genericPoster;
                        }}
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

          {/* ── Upcoming Events ───────────────────────────────────────── */}
          {events.length > 0 && (
            <div className="mt-16">
              <div className="flex items-center gap-2 mb-4">
                <Star size={16} className="text-amber-500" />
                <span className="text-xs font-bold tracking-widest uppercase text-amber-600">Upcoming Events</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7">
                {events.map((event) => (
                  <article key={event.id} className="group rounded-xl overflow-hidden bg-white border border-slate-200 hover:shadow-xl transition-shadow">
                    <Link to={`/events/${event.id}`}>
                      <div className="relative aspect-[2/3] overflow-hidden">
                        <img
                          src={event.imageUrl || genericPoster}
                          alt={event.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = genericPoster;
                          }}
                        />
                      </div>
                    </Link>

                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <Link to={`/events/${event.id}`} className="font-bold leading-tight hover:text-amber-600 transition-colors">
                          {event.name}
                        </Link>
                      </div>
                      <p className="text-xs text-slate-500">Sự kiện đặc biệt</p>
                      <RatingBadge type="event" id={event.id} />
                      <p className="text-sm text-slate-700">{new Date(event.startTime).toLocaleDateString('vi-VN')} - {new Date(event.endTime).toLocaleDateString('vi-VN')}</p>
                      <p className="text-sm text-slate-600">{event.venue}</p>
                      <div className="pt-2 flex items-center justify-between">
                        <Link to={`/events/${event.id}`} className="text-sm font-semibold text-amber-600 hover:underline">
                          Chi tiết & Đặt vé
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

        </section>

      </main>
    </div>
  );
};
