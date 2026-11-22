import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Star, Film, ChevronLeft, ChevronRight, Sparkles, TrendingUp, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { RatingBadge } from '../components/Review/RatingBadge';
import { calculateEndTime, formatDuration, movies as mockMovies } from '../utils/movieData';
import { SiteTopNav } from '../components/SiteTopNav';
import { useMovies } from '../hooks/useMovies';
import { useRecommendations } from '../hooks/useRecommendations';
import { useAuthStore } from '../store/authStore';
import { eventService, EventResponse } from '../services/eventService';
import { MovieResponse } from '../services/movieService';
import { catalogService } from '../services/catalogService';
import { recommendationService, TopKRecommendation } from '../services/recommendationService';
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

function backendToCard(m: MovieResponse, t: (key: string) => string): HomeMovieCard {
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
      ? t('home.stopped')
      : (new Date(m.releaseDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0) ? t('home.comingSoon') : t('home.nowShowing')),
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [events, setEvents] = useState<EventResponse[]>([]);

  // Fetch real movies from backend
  const { backendMovies, isLoading: isLoadingBackend } = useMovies();
  const { recommendations, isLoading: isLoadingRecs } = useRecommendations(4);
  const user = useAuthStore(state => state.user);
  const [topK, setTopK] = useState<TopKRecommendation[]>([]);
  const [topKState, setTopKState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  // Client-side Top-K & Recommendation filter state
  const [topKLimit, setTopKLimit] = useState<number>(5); // default k = 5 according to SRS
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');

  // Calculate catalog min and max release years
  const { minCatalogYear, maxCatalogYear } = useMemo(() => {
    let min = 2020;
    let max = 2026;
    const years: number[] = [];
    backendMovies.forEach(m => {
      if (m.releaseDate) {
        const yr = new Date(m.releaseDate).getFullYear();
        if (!isNaN(yr) && yr > 1900 && yr < 2100) years.push(yr);
      }
    });
    if (years.length > 0) {
      min = Math.min(...years);
      max = Math.max(...years);
    }
    return { minCatalogYear: min, maxCatalogYear: max };
  }, [backendMovies]);

  const [yearRange, setYearRange] = useState<[number, number]>([2020, 2026]);

  useEffect(() => {
    setYearRange([minCatalogYear, maxCatalogYear]);
  }, [minCatalogYear, maxCatalogYear]);

  // Standard comprehensive list of movie production countries
  const standardCountries = useMemo(() => [
    { code: 'VN', name: 'Vietnam', labelEn: 'Vietnam', labelVi: 'Việt Nam' },
    { code: 'US', name: 'USA', labelEn: 'United States', labelVi: 'Hoa Kỳ / Mỹ' },
    { code: 'GB', name: 'UK', labelEn: 'United Kingdom', labelVi: 'Vương quốc Anh' },
    { code: 'KR', name: 'South Korea', labelEn: 'South Korea', labelVi: 'Hàn Quốc' },
    { code: 'JP', name: 'Japan', labelEn: 'Japan', labelVi: 'Nhật Bản' },
    { code: 'CN', name: 'China', labelEn: 'China', labelVi: 'Trung Quốc' },
    { code: 'FR', name: 'France', labelEn: 'France', labelVi: 'Pháp' },
    { code: 'DE', name: 'Germany', labelEn: 'Germany', labelVi: 'Đức' },
    { code: 'IN', name: 'India', labelEn: 'India', labelVi: 'Ấn Độ' },
    { code: 'TH', name: 'Thailand', labelEn: 'Thailand', labelVi: 'Thái Lan' },
    { code: 'ES', name: 'Spain', labelEn: 'Spain', labelVi: 'Tây Ban Nha' },
    { code: 'IT', name: 'Italy', labelEn: 'Italy', labelVi: 'Ý' },
    { code: 'CA', name: 'Canada', labelEn: 'Canada', labelVi: 'Canada' },
    { code: 'AU', name: 'Australia', labelEn: 'Australia', labelVi: 'Úc' },
  ], []);

  // Merge standard list with any custom region stored in database
  const availableCountryOptions = useMemo(() => {
    const existing = new Set(standardCountries.map(c => c.name.toLowerCase()));
    const extra: { name: string; labelEn: string; labelVi: string }[] = [];
    backendMovies.forEach(m => {
      if (m.region && m.region.trim()) {
        const norm = m.region.trim();
        if (!existing.has(norm.toLowerCase()) && !extra.some(e => e.name.toLowerCase() === norm.toLowerCase())) {
          extra.push({ name: norm, labelEn: norm, labelVi: norm });
        }
      }
    });
    return [...standardCountries, ...extra];
  }, [backendMovies, standardCountries]);

  // Matching helper for countries
  const matchesCountry = (movieRegion: string | undefined, selected: string): boolean => {
    if (!selected) return true;
    if (!movieRegion) return false;
    const r = movieRegion.trim().toLowerCase();
    const s = selected.trim().toLowerCase();
    if (r === s) return true;
    if ((s === 'usa' || s === 'united states' || s === 'us') && (r === 'usa' || r === 'united states' || r === 'us')) return true;
    if ((s === 'uk' || s === 'united kingdom' || s === 'gb') && (r === 'uk' || r === 'united kingdom' || r === 'gb')) return true;
    if ((s === 'vietnam' || s === 'việt nam' || s === 'vn') && (r === 'vietnam' || r === 'việt nam' || r === 'vn')) return true;
    if ((s === 'south korea' || s === 'hàn quốc' || s === 'korea' || s === 'kr') && (r === 'south korea' || r === 'hàn quốc' || r === 'korea' || r === 'kr')) return true;
    if ((s === 'japan' || s === 'nhật bản' || s === 'jp') && (r === 'japan' || r === 'nhật bản' || r === 'jp')) return true;
    return r.includes(s) || s.includes(r);
  };

  useEffect(() => {
    if (!user) {
      setTopK([]);
      setTopKState('idle');
      return;
    }
    let cancelled = false;
    setTopKState('loading');
    // Fetch generous candidate pool so client-side filters (Genre, Year, Country) have plenty of items
    recommendationService.getTopK(50)
      .then((items) => {
        if (cancelled) return;
        setTopK(items);
        setTopKState('ready');
      })
      .catch(() => {
        if (!cancelled) setTopKState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Available filter options based on catalog
  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    backendMovies.forEach(m => m.genres?.forEach(g => { if (g) set.add(g); }));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [backendMovies]);

  // Filtered Top-K recommendations
  const filteredTopK = useMemo(() => {
    const filtered = topK.filter((rec) => {
      const fullMovie = backendMovies.find(m => m.id === rec.movieId);
      if (selectedGenre) {
        const movieGenres = fullMovie?.genres || [];
        if (!movieGenres.includes(selectedGenre)) return false;
      }
      if (fullMovie?.releaseDate) {
        const yr = new Date(fullMovie.releaseDate).getFullYear();
        if (!isNaN(yr) && (yr < yearRange[0] || yr > yearRange[1])) {
          return false;
        }
      }
      if (selectedCountry && !matchesCountry(fullMovie?.region, selectedCountry)) {
        return false;
      }
      return true;
    });

    return filtered.slice(0, Math.max(1, topKLimit));
  }, [topK, backendMovies, selectedGenre, yearRange, selectedCountry, topKLimit]);

  const totalMatchingRecs = useMemo(() => {
    return topK.filter((rec) => {
      const fullMovie = backendMovies.find(m => m.id === rec.movieId);
      if (selectedGenre && (!fullMovie?.genres || !fullMovie.genres.includes(selectedGenre))) return false;
      if (fullMovie?.releaseDate) {
        const yr = new Date(fullMovie.releaseDate).getFullYear();
        if (!isNaN(yr) && (yr < yearRange[0] || yr > yearRange[1])) return false;
      }
      if (selectedCountry && !matchesCountry(fullMovie?.region, selectedCountry)) return false;
      return true;
    }).length;
  }, [topK, backendMovies, selectedGenre, yearRange, selectedCountry]);

  const isYearFiltered = yearRange[0] > minCatalogYear || yearRange[1] < maxCatalogYear;
  const hasActiveFilters = selectedGenre !== '' || isYearFiltered || selectedCountry !== '' || topKLimit !== 5;

  const handleResetFilters = () => {
    setSelectedGenre('');
    setYearRange([minCatalogYear, maxCatalogYear]);
    setSelectedCountry('');
    setTopKLimit(5);
  };

  useEffect(() => {
    eventService.getEvents().then(setEvents).catch(console.error);
  }, []);

  // ── Build a unified card list ────────────────────────────────────────────
  // Backend movies first, then mock movies below them.
  // TODO: Remove mockCards once backend data is complete.
  const allCards: HomeMovieCard[] = useMemo(() => {
    const backendCards = backendMovies.map(m => backendToCard(m, t));
    const mockCards = mockMovies.map(mockToCard);
    return [...backendCards, ...mockCards];
  }, [backendMovies, t]);

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
    <div className="min-h-screen bg-surface text-on-surface">
      <SiteTopNav
        activeLabel="Movies"
        showSearch
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSearchSubmit={submitSearch}
        suggestions={suggestions}
      />

      <main className="pt-16 pb-24 md:pb-12">
        {/* ── Hero ────────────────────────────────────────────────────── */}
        <section className="relative min-h-[440px] md:min-h-[540px] lg:h-[620px] py-10 lg:py-0 overflow-hidden bg-inverse-surface flex items-center">
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

          <div className="relative max-w-[1280px] mx-auto w-full px-4 sm:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-8 xl:gap-12">
            <div className="max-w-xl w-full">
              <span className="inline-block px-3 py-1 rounded-sm bg-primary text-on-primary text-[10px] tracking-[0.2em] uppercase font-bold mb-4 sm:mb-6">
                {t('home.nowPremiering')}
              </span>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight mb-4 sm:mb-6 line-clamp-2">
                {heroCard?.title ?? t('home.heroTitleDefault')}
              </h1>
              <p className="text-inverse-on-surface text-sm sm:text-lg leading-relaxed mb-6 sm:mb-8 line-clamp-3">
                {t('home.heroDesc')}
              </p>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                {heroCard && (
                  <Link
                    to={`/movies/${heroCard.id}`}
                    className="px-5 sm:px-7 py-3 rounded-lg bg-primary text-on-primary text-sm sm:text-base font-semibold hover:opacity-90 transition-colors min-h-[44px] inline-flex items-center"
                  >
                    {t('home.exploreMovie')}
                  </Link>
                )}
                <button
                  onClick={() => submitSearch('')}
                  className="px-5 sm:px-7 py-3 rounded-lg bg-surface-container-lowest/10 border border-white/20 text-white text-sm sm:text-base font-semibold hover:bg-surface-container-lowest/20 transition-colors min-h-[44px]"
                >
                  {t('home.browseAll')}
                </button>
              </div>
            </div>

            {heroMovies.length > 1 && (
              <div className="lg:hidden flex items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5">
                  {heroMovies.map((m, idx) => (
                    <button
                      key={`dot-${m.id}`}
                      type="button"
                      onClick={() => setCurrentHeroIndex(idx)}
                      aria-label={m.title}
                      className={`h-2 rounded-full transition-all ${
                        idx === currentHeroIndex ? 'w-6 bg-primary' : 'w-2 bg-white/40'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevHero}
                    aria-label="Previous"
                    className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center border border-white/15"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextHero}
                    aria-label="Next"
                    className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center border border-white/15"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* Carousel Posters (hidden on small screens) */}
            {heroMovies.length > 0 && (
              <div className="hidden lg:flex items-center gap-2 xl:gap-4 relative z-10 mt-12">
                <button
                  onClick={handlePrevHero}
                  className="p-2 rounded-full bg-black/40 text-white hover:bg-primary transition-colors backdrop-blur-sm border border-white/10 flex-shrink-0"
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
                  className="p-2 rounded-full bg-black/40 text-white hover:bg-primary transition-colors backdrop-blur-sm border border-white/10"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── Uncertainty top-k for a signed-in user ─────────────────── */}
        {user && topKState !== 'error' && topKState !== 'idle' && (
          <section id="recommended" className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
            <div className="flex flex-wrap items-baseline justify-between gap-2 sm:gap-4 mb-6 sm:mb-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                  <Sparkles className="text-amber-500 shrink-0" size={24} />
                  {t('home.recommendedForYou', 'Recommended for You')}
                </h2>
                <p className="text-sm sm:text-base text-on-surface-variant mt-1">
                  {t('home.recommendedDesc', 'Picks from movies you rated, with a confidence score.')}
                </p>
              </div>
              <Link to="/my-ratings" className="text-sm font-semibold text-primary hover:underline shrink-0 min-h-[36px] inline-flex items-center">
                {t('home.myRatings', 'Movies I rated')}
              </Link>
            </div>

            {/* ── Top-K & Recommendation Filter Controls ── */}
            {topKState === 'ready' && topK.length > 0 && (
              <div className="mb-6 p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Top-K Selector */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                      <SlidersHorizontal size={14} className="text-primary" />
                      Top-K:
                    </span>
                    <div className="inline-flex rounded-lg bg-surface-container-high p-0.5 border border-outline-variant/20">
                      {[3, 5, 10, 20].map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setTopKLimit(k)}
                          className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                            topKLimit === k
                              ? 'bg-primary text-on-primary shadow-sm'
                              : 'text-on-surface-variant hover:text-on-surface'
                          }`}
                        >
                          Top {k}
                        </button>
                      ))}
                    </div>
                    {/* Custom K Number Input */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-on-surface-variant font-medium">K =</span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={topKLimit}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) setTopKLimit(Math.max(1, Math.min(50, val)));
                        }}
                        className="w-14 px-2 py-1 text-xs font-semibold bg-surface-container-high border border-outline-variant/40 rounded-md text-on-surface text-center focus:outline-none focus:ring-1 focus:ring-primary"
                        title="Custom Top-K (1-50)"
                      />
                    </div>
                  </div>

                  {/* Reset Filters Button */}
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      <RotateCcw size={12} />
                      {t('home.resetFilters', 'Reset filters')}
                    </button>
                  )}
                </div>

                {/* Genre, Year, Country Selects */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-outline-variant/20">
                  {/* Genre Select */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                      {t('home.filterGenre', 'Genre')}
                    </label>
                    <select
                      value={selectedGenre}
                      onChange={(e) => setSelectedGenre(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-surface-container-high border border-outline-variant/40 rounded-lg text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">{t('home.allGenres', 'All Genres')}</option>
                      {availableGenres.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  {/* Release Year Range Slider */}
                  <div className="flex flex-col justify-center">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                      <span>{t('home.filterYear', 'Release Year')}</span>
                      <span className="text-primary font-bold">{yearRange[0]} – {yearRange[1]}</span>
                    </div>
                    <div className="relative h-6 flex items-center">
                      <div className="absolute w-full h-1.5 bg-surface-container-highest rounded-full" />
                      <div
                        className="absolute h-1.5 bg-primary rounded-full"
                        style={{
                          left: `${Math.max(0, Math.min(100, ((yearRange[0] - minCatalogYear) / Math.max(1, maxCatalogYear - minCatalogYear)) * 100))}%`,
                          right: `${Math.max(0, Math.min(100, 100 - ((yearRange[1] - minCatalogYear) / Math.max(1, maxCatalogYear - minCatalogYear)) * 100))}%`
                        }}
                      />
                      <input
                        type="range"
                        min={minCatalogYear}
                        max={maxCatalogYear}
                        value={yearRange[0]}
                        onChange={(e) => {
                          const val = Math.min(Number(e.target.value), yearRange[1]);
                          setYearRange([val, yearRange[1]]);
                        }}
                        className="absolute w-full pointer-events-none appearance-none bg-transparent accent-primary [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer"
                        title={`From year ${yearRange[0]}`}
                      />
                      <input
                        type="range"
                        min={minCatalogYear}
                        max={maxCatalogYear}
                        value={yearRange[1]}
                        onChange={(e) => {
                          const val = Math.max(Number(e.target.value), yearRange[0]);
                          setYearRange([yearRange[0], val]);
                        }}
                        className="absolute w-full pointer-events-none appearance-none bg-transparent accent-primary [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer"
                        title={`To year ${yearRange[1]}`}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-on-surface-variant font-medium">
                      <span>{minCatalogYear}</span>
                      <span>{maxCatalogYear}</span>
                    </div>
                  </div>

                  {/* Country / Region Select */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                      {t('home.filterCountry', 'Country / Region')}
                    </label>
                    <select
                      value={selectedCountry}
                      onChange={(e) => setSelectedCountry(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-surface-container-high border border-outline-variant/40 rounded-lg text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">{t('home.allCountries', 'All Countries')}</option>
                      {availableCountryOptions.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.labelVi ? `${c.labelVi} (${c.labelEn})` : c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Status / count info */}
                <div className="flex items-center justify-between text-xs text-on-surface-variant">
                  <span>
                    {t('home.showingPicks', {
                      shown: filteredTopK.length,
                      total: totalMatchingRecs,
                      k: topKLimit
                    })}
                  </span>
                  {selectedGenre && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[11px] font-medium">{selectedGenre}</span>}
                </div>
              </div>
            )}

            {topKState === 'loading' && (
              <p className="text-sm text-on-surface-variant mb-8">{t('home.topKLoading', 'Loading your picks...')}</p>
            )}

            {topKState === 'ready' && topK.length === 0 && (
              <p className="text-sm text-on-surface-variant mb-8">{t('home.topKEmpty', 'No showing movies to recommend yet.')}</p>
            )}

            {topKState === 'ready' && topK.length > 0 && filteredTopK.length === 0 && (
              <div className="p-6 sm:p-8 text-center bg-surface-container-low rounded-xl border border-outline-variant/30 mb-8">
                <p className="text-sm font-semibold text-on-surface mb-1">
                  {t('home.noMatchingRecommendations', 'No recommendations match your current filters.')}
                </p>
                <p className="text-xs text-on-surface-variant mb-4">
                  {t('home.tryAdjustingFilters', 'Try choosing another genre, year, or country, or reset the filters.')}
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-4 py-2 min-h-[36px] bg-primary text-on-primary rounded-lg text-xs font-semibold hover:opacity-90 inline-flex items-center gap-1.5"
                  >
                    <RotateCcw size={12} />
                    {t('home.resetFilters', 'Reset filters')}
                  </button>
                )}
              </div>
            )}

            {topKState === 'ready' && filteredTopK.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 mb-10 sm:mb-12">
                {filteredTopK.map((rec) => {
                  const match = Math.round(Math.min(100, Math.max(0, rec.predictedRating * 20)));
                  const confidence = Math.round(Math.min(100, Math.max(0, 100 - rec.uncertaintyScore)));
                  const fullMovie = backendMovies.find(m => m.id === rec.movieId);
                  return (
                    <article key={rec.movieId} className="group rounded-xl overflow-hidden bg-surface-container-lowest border border-outline-variant hover:shadow-xl transition-shadow flex flex-col">
                      <Link to={`/movies/${rec.movieId}`}>
                        <div className="relative aspect-[2/3] overflow-hidden">
                          <img
                            src={rec.posterUrl || genericPoster}
                            alt={rec.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src = genericPoster;
                            }}
                          />
                          <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-amber-400 text-[10px] sm:text-xs font-bold border border-white/10">
                            {t('home.match', 'Match')} {match}%
                          </div>
                        </div>
                      </Link>
                      <div className="p-3 sm:p-4 space-y-1.5 sm:space-y-2 flex-1">
                        <Link to={`/movies/${rec.movieId}`} className="font-bold text-sm sm:text-base leading-tight hover:opacity-90 line-clamp-2 block">
                          {rec.title}
                        </Link>
                        {fullMovie && (
                          <p className="text-xs text-on-surface-variant line-clamp-1">
                            {fullMovie.genres?.join(', ') || 'Movie'}
                            {fullMovie.releaseDate ? ` • ${new Date(fullMovie.releaseDate).getFullYear()}` : ''}
                            {fullMovie.region ? ` • ${fullMovie.region}` : ''}
                          </p>
                        )}
                        <p className="text-xs text-on-surface-variant">
                          {t('home.confidence', 'Confidence')} {confidence}%
                        </p>
                        {rec.nearestMovieId != null && rec.nearestMovieTitle && (
                          <Link to={`/movies/${rec.nearestMovieId}`} className="text-xs text-primary hover:underline line-clamp-2 block">
                            {t('home.becauseRated', { title: rec.nearestMovieTitle })}
                          </Link>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Neo4j recommendations: guests, or signed-in fallback ──── */}
        {(!user || topKState === 'error') && (recommendations.length > 0 || isLoadingRecs) && (
          <section id="recommended" className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-6 sm:mb-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                  {user ? (
                    <>
                      <Sparkles className="text-amber-500 shrink-0" size={24} />
                      {t('home.recommendedForYou', 'Recommended for You')}
                    </>
                  ) : (
                    <>
                      <TrendingUp className="text-primary shrink-0" size={24} />
                      {t('home.popularMovies', 'Popular Movies')}
                    </>
                  )}
                </h2>
                <p className="text-sm sm:text-base text-on-surface-variant mt-1">
                  {user ? t('home.recommendedDesc', 'Picks from movies you rated, with a confidence score.') : t('home.popularDesc', 'Trending movies everyone is watching.')}
                </p>
                {!user && (
                  <Link to="/login" className="inline-flex items-center min-h-[36px] text-sm font-semibold text-primary mt-1 hover:underline">
                    {t('home.loginForPersonal', 'Sign in to see picks based on your ratings.')}
                  </Link>
                )}
              </div>
            </div>

            {isLoadingRecs && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 mb-7">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl overflow-hidden bg-surface-container-lowest border border-outline-variant animate-pulse">
                    <div className="aspect-[2/3] bg-surface-container-high" />
                    <div className="p-3 sm:p-4 space-y-2">
                      <div className="h-4 bg-surface-container-high rounded w-3/4" />
                      <div className="h-3 bg-surface-container rounded w-1/2" />
                      <div className="h-3 bg-surface-container rounded w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoadingRecs && recommendations.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 mb-10 sm:mb-12">
                {recommendations.map((rec) => {
                  // Find full movie details from backendMovies, if missing just use fallback metadata
                  const fullMovie = backendMovies.find(m => m.id === rec.movieId);
                  // We map to HomeMovieCard
                  let card: HomeMovieCard;

                  if (fullMovie) {
                    card = backendToCard(fullMovie, t);
                  } else {
                    // Fallback card if the movie isn't in the main catalog list (e.g. inactive)
                    card = {
                      id: rec.movieId,
                      title: rec.title,
                      genre: rec.matchedGenres?.join(', ') || 'Movie',
                      durationMinutes: 0,
                      rating: 0,
                      posterUrl: rec.posterUrl || '',
                      backdropUrl: rec.posterUrl || '',
                      firstShowLabel: '',
                      theaterName: t('home.recommended', 'Recommended'),
                      priceLabel: '',
                      isBackend: true,
                    };
                  }

                  return (
                    <article key={card.id} className="group rounded-xl overflow-hidden bg-surface-container-lowest border border-outline-variant hover:shadow-xl transition-shadow relative">
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
                          {fullMovie?.active && (
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-success text-white text-[10px] font-bold">
                              {t('home.nowShowing')}
                            </span>
                          )}
                          <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-amber-400 text-xs font-bold flex items-center gap-1 border border-white/10 shadow-lg">
                            <Star size={12} className="fill-amber-400" />
                            {rec.avgRating > 0 ? rec.avgRating.toFixed(1) : 'New'}
                          </div>
                        </div>
                      </Link>

                      <div className="p-3 sm:p-4 space-y-1.5 sm:space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <Link to={`/movies/${card.id}`} className="font-bold text-sm sm:text-base leading-tight hover:opacity-90 transition-colors line-clamp-2">
                            {card.title}
                          </Link>
                        </div>
                        {card.durationMinutes > 0 && (
                          <p className="text-xs text-on-surface-variant line-clamp-1">{card.genre} – {formatDuration(card.durationMinutes)}</p>
                        )}
                        {!card.durationMinutes && (
                          <p className="text-xs text-on-surface-variant line-clamp-1">{card.genre}</p>
                        )}
                        <p className="text-xs sm:text-sm text-on-surface-variant truncate">{card.firstShowLabel}</p>
                        <p className="text-xs sm:text-sm text-on-surface-variant truncate">{card.theaterName}</p>
                        <div className="pt-1 sm:pt-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-on-surface-variant">{fullMovie?.ageRating || ''}</span>
                          {fullMovie && <RatingBadge type="movie" id={fullMovie.id} />}
                          <Link to={`/movies/${card.id}`} className="text-xs sm:text-sm font-semibold text-primary hover:underline min-h-[36px] inline-flex items-center">
                            {t('home.detailsAndBook')}
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Current Screenings ─────────────────────────────────────── */}
        <section id="movies" className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex flex-wrap items-baseline justify-between gap-2 sm:gap-4 mb-6 sm:mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('home.currentScreenings')}</h2>
            </div>
            <button onClick={() => submitSearch('')} className="text-sm font-semibold text-primary hover:underline shrink-0 min-h-[36px] inline-flex items-center">
              {t('home.viewFullSchedule')}
            </button>
          </div>

          {/* Loading skeleton */}
          {isLoadingBackend && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 mb-7">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden bg-surface-container-lowest border border-outline-variant animate-pulse">
                  <div className="aspect-[2/3] bg-surface-container-high" />
                  <div className="p-3 sm:p-4 space-y-2">
                    <div className="h-4 bg-surface-container-high rounded w-3/4" />
                    <div className="h-3 bg-surface-container rounded w-1/2" />
                    <div className="h-3 bg-surface-container rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Backend movies section ────────────────────────────────── */}
          {backendMovies.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <Film size={16} className="text-primary" />
                <span className="text-xs font-bold tracking-widest uppercase text-primary">{t('home.fromCinema')}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 mb-10 sm:mb-12">
                {backendMovies.map((movie) => {
                  const card = backendToCard(movie, t);
                  return (
                    <article key={card.id} className="group rounded-xl overflow-hidden bg-surface-container-lowest border border-outline-variant hover:shadow-xl transition-shadow flex flex-col">
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
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-success text-white text-[10px] font-bold">
                              {t('home.nowShowing')}
                            </span>
                          )}
                        </div>
                      </Link>

                      <div className="p-3 sm:p-4 space-y-1.5 sm:space-y-2 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <Link to={`/movies/${card.id}`} className="font-bold text-sm sm:text-base leading-tight hover:opacity-90 transition-colors line-clamp-2">
                            {card.title}
                          </Link>
                        </div>

                        <p className="text-xs text-on-surface-variant line-clamp-1">{card.genre} – {formatDuration(card.durationMinutes)}</p>
                        <p className="text-xs sm:text-sm text-on-surface-variant truncate">{card.firstShowLabel}</p>
                        <p className="text-xs sm:text-sm text-on-surface-variant truncate">{card.theaterName}</p>
                        <div className="pt-1 sm:pt-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-on-surface-variant">{movie.ageRating}</span>
                          <RatingBadge type="movie" id={movie.id} />
                          <Link to={`/movies/${card.id}`} className="text-xs sm:text-sm font-semibold text-primary hover:underline min-h-[36px] inline-flex items-center">
                            {t('home.detailsAndBook')}
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
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Star size={16} className="text-amber-500" />
            <span className="text-xs font-bold tracking-widest uppercase text-amber-600">Featured Showcase</span>
            <span className="text-[10px] text-on-surface-variant sm:ml-2">(mock data – remove later)</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {mockMovies.map((movie) => {
              const firstShow = movie.showtimes[0];
              const endTime = calculateEndTime(firstShow.startTime, movie.durationMinutes);

              return (
                <article key={movie.id} className="group rounded-xl overflow-hidden bg-surface-container-lowest border border-outline-variant hover:shadow-xl transition-shadow flex flex-col">
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

                  <div className="p-3 sm:p-4 space-y-1.5 sm:space-y-2 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/movies/${movie.id}`} className="font-bold text-sm sm:text-base leading-tight hover:opacity-90 transition-colors line-clamp-2">
                        {movie.title}
                      </Link>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 shrink-0">
                        <Star size={13} className="fill-amber-400 text-amber-400" /> {movie.rating}
                      </span>
                    </div>

                    <p className="text-xs text-on-surface-variant line-clamp-1">{movie.genre} - {formatDuration(movie.durationMinutes)}</p>
                    <p className="text-xs sm:text-sm text-on-surface-variant truncate">{firstShow.startTime} - {endTime}</p>
                    <p className="text-xs sm:text-sm text-on-surface-variant truncate">{firstShow.theaterName}</p>
                    <div className="pt-1 sm:pt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm sm:text-lg font-black">${firstShow.price.toFixed(2)}</span>
                      <Link to={`/movies/${movie.id}`} className="text-xs sm:text-sm font-semibold text-primary hover:underline min-h-[36px] inline-flex items-center">
                        {t('home.details')}
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
            <div className="mt-12 sm:mt-16">
              <div className="flex items-center gap-2 mb-4 mt-8">
                <span className="text-xs font-bold tracking-widest uppercase text-on-surface-variant">{t('home.simulated')}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                {events.map((event) => (
                  <article key={event.id} className="group rounded-xl overflow-hidden bg-surface-container-lowest border border-outline-variant hover:shadow-xl transition-shadow flex flex-col">
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

                    <div className="p-3 sm:p-4 space-y-1.5 sm:space-y-2 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/events/${event.id}`} className="font-bold text-sm sm:text-base leading-tight hover:text-amber-600 transition-colors line-clamp-2">
                          {event.name}
                        </Link>
                      </div>
                      <p className="text-xs text-on-surface-variant">{t('home.specialEvent')}</p>
                      <RatingBadge type="event" id={event.id} />
                      <p className="text-xs sm:text-sm text-on-surface-variant truncate">{new Date(event.startTime).toLocaleDateString('vi-VN')} - {new Date(event.endTime).toLocaleDateString('vi-VN')}</p>
                      <p className="text-xs sm:text-sm text-on-surface-variant truncate">{event.venue}</p>
                      <div className="pt-1 sm:pt-2 flex flex-wrap items-center justify-between gap-2">
                        <Link to={`/events/${event.id}`} className="text-xs sm:text-sm font-semibold text-amber-600 hover:underline min-h-[36px] inline-flex items-center">
                          {t('home.detailsAndBook')}
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
