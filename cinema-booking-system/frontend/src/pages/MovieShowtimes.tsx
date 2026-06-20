import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin } from 'lucide-react';
import { movieService, MovieResponse } from '../services/movieService';
import { showtimeService } from '../services/showtimeService';
import { ShowtimeResponse } from '../types/showtime';
import { useBookingStore } from '../store/bookingStore';
import genericPoster from '../resources/generic_movie_poster.png';

export const MovieShowtimes: React.FC = () => {
  const navigate = useNavigate();
  const { movieId } = useParams<{ movieId: string }>();

  const [movie, setMovie] = useState<MovieResponse | null>(null);
  const [showtimes, setShowtimes] = useState<ShowtimeResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string>('');

  const { setMovieTitle, setMoviePosterUrl } = useBookingStore();

  useEffect(() => {
    if (!movieId) return;
    setIsLoading(true);
    Promise.all([
      movieService.getMovieById(movieId),
      showtimeService.getShowtimes(parseInt(movieId, 10)),
    ])
      .then(([m, s]) => {
        setMovie(m);
        const scheduled = s.filter((st) => st.status === 'SCHEDULED');
        setShowtimes(scheduled);

        // Pre-select the earliest date available, or today
        if (scheduled.length > 0) {
          const firstDate = new Date(scheduled[0].startTime);
          setSelectedDateStr(firstDate.toISOString().split('T')[0]);
        } else {
          setSelectedDateStr(new Date().toISOString().split('T')[0]);
        }
      })
      .catch(() => setError('Không thể tải thông tin lịch chiếu.'))
      .finally(() => setIsLoading(false));
  }, [movieId]);

  const handleBookShowtime = (showtime: ShowtimeResponse) => {
    if (movie) {
      setMovieTitle(movie.title);
      setMoviePosterUrl(movie.posterUrl);
    }
    navigate(`/user/booking/${showtime.id}`);
  };

  // Generate the next 7 days for the date selector
  const availableDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, []);

  // Filter showtimes by selected date, then group by cinema
  const groupedShowtimes = useMemo(() => {
    if (!selectedDateStr) return {};

    const filtered = showtimes.filter((st) => {
      return st.startTime.startsWith(selectedDateStr);
    });

    const groups: Record<string, { cinemaName: string; showtimes: ShowtimeResponse[] }> = {};
    for (const st of filtered) {
      const cId = st.cinemaId ? String(st.cinemaId) : 'unknown';
      const cName = st.cinemaName || 'Rạp không xác định';
      if (!groups[cId]) {
        groups[cId] = { cinemaName: cName, showtimes: [] };
      }
      groups[cId].showtimes.push(st);
    }

    // Sort showtimes within each group
    for (const key in groups) {
      groups[key].showtimes.sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    }

    return groups;
  }, [showtimes, selectedDateStr]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center">
        <p className="text-on-surface-variant animate-pulse font-medium">Đang tải...</p>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center px-6">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold">Lỗi</h1>
          <p className="text-on-surface-variant">{error ?? 'Không tìm thấy phim.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="fixed top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-surface-container-low">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-black tracking-tight text-lg text-primary">
            CinemaArchitect
          </Link>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <ArrowLeft size={16} /> Quay lại
          </button>
        </div>
      </header>

      <main className="pt-16 pb-20">
        {/* Movie Header Info */}
        <section className="bg-surface-container-lowest border-b border-surface-container-low py-8 px-6">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-6">
              <img
                src={movie.posterUrl || genericPoster}
                alt={movie.title}
                className="w-24 h-36 object-cover rounded-lg shadow-md"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = genericPoster;
                }}
              />
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-primary text-white rounded text-xs font-bold">
                  {movie.ageRating}
                </span>
                <span className="text-sm font-medium text-on-surface-variant">
                  {movie.durationMinutes} phút
                </span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-on-surface">{movie.title}</h1>
              <div className="flex flex-wrap gap-2 text-sm text-on-surface-variant font-medium">
                {movie.genres.join(', ')}
              </div>
            </div>
          </div>
        </section>

        {/* Date Selector */}
        <section className="border-b border-surface-container-low sticky top-16 z-40 bg-white/90 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-6 py-4 overflow-x-auto no-scrollbar">
            <div className="flex gap-4 min-w-max">
              {availableDates.map((date) => {
                const dateStr = date.toISOString().split('T')[0];
                const isSelected = dateStr === selectedDateStr;
                const dayName = new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(date);
                const dayOfMonth = date.getDate();
                const month = date.getMonth() + 1;

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDateStr(dateStr)}
                    className={`flex flex-col items-center justify-center w-16 h-20 rounded-xl transition-all ${
                      isSelected
                        ? 'bg-primary text-white shadow-md scale-105'
                        : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                      {dayName}
                    </span>
                    <span className="text-xl font-black tracking-tighter leading-none mt-1">
                      {dayOfMonth}
                    </span>
                    <span className="text-[10px] font-medium opacity-80 mt-1">
                      Th {month}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Showtimes List */}
        <section className="max-w-5xl mx-auto px-6 py-10 space-y-10">
          {Object.keys(groupedShowtimes).length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg font-semibold text-on-surface-variant mb-2">
                Không có suất chiếu nào
              </p>
              <p className="text-sm text-outline">
                Vui lòng chọn ngày khác hoặc thử lại sau.
              </p>
            </div>
          ) : (
            Object.values(groupedShowtimes).map((group, idx) => (
              <div key={idx} className="bg-surface-container-lowest rounded-2xl p-6 border border-surface-container-low shadow-sm">
                <div className="flex items-center gap-3 mb-6 border-b border-surface-container-low pb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <MapPin size={20} />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-on-surface">
                    {group.cinemaName}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-4">
                  {group.showtimes.map((st) => {
                    const now = Date.now();
                    const isClosed = new Date(st.startTime).getTime() - now < 5 * 60 * 1000;
                    return (
                      <button
                        key={st.id}
                        onClick={() => handleBookShowtime(st)}
                        disabled={isClosed}
                        className={`group relative flex flex-col items-center justify-center w-24 h-16 rounded-xl transition-all ${
                          isClosed
                            ? 'bg-surface-container-highest border-2 border-surface-container-highest opacity-50 cursor-not-allowed'
                            : 'bg-surface-container-lowest border-2 border-surface-container-highest hover:border-primary hover:bg-primary/5'
                        }`}
                      >
                        <span className={`text-lg font-bold transition-colors ${
                          isClosed ? 'text-on-surface-variant' : 'text-on-surface group-hover:text-primary'
                        }`}>
                          {formatTime(st.startTime)}
                        </span>
                        {st.roomName && (
                          <span className="text-[10px] font-semibold text-outline uppercase tracking-widest mt-0.5">
                            {st.roomName}
                          </span>
                        )}
                        {isClosed && (
                          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm uppercase tracking-wider">
                            Đã đóng
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
};
