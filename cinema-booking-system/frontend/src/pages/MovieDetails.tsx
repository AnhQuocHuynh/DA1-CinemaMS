import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, Calendar, Clock, Globe } from 'lucide-react';
import { movieService, MovieResponse } from '../services/movieService';
import { showtimeService } from '../services/showtimeService';
import { ShowtimeResponse } from '../types/showtime';
import { useBookingStore } from '../store/bookingStore';
import { formatVND, parseVND, formatShowtime } from '../utils/formatters';

export const MovieDetails: React.FC = () => {
  const navigate = useNavigate();
  const { movieId } = useParams<{ movieId: string }>();

  const [movie, setMovie] = useState<MovieResponse | null>(null);
  const [showtimes, setShowtimes] = useState<ShowtimeResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setShowtimes(s.filter((st) => st.status === 'SCHEDULED'));
      })
      .catch(() => setError('Không thể tải thông tin phim.'))
      .finally(() => setIsLoading(false));
  }, [movieId]);
  const handleBookNow = () => {
    navigate(`/movies/${movieId}/showtimes`);
  };

  const handleBookShowtime = (showtime: ShowtimeResponse) => {
    if (movie) {
      setMovieTitle(movie.title);
      setMoviePosterUrl(movie.posterUrl);
    }
    navigate(`/user/booking/${showtime.id}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-500 animate-pulse">Đang tải...</p>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center px-6">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold">Không tìm thấy phim</h1>
          <p className="text-slate-600">{error ?? 'Phim không tồn tại.'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="fixed top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-black tracking-tight text-lg text-slate-900">
            CinemaArchitect
          </Link>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={16} /> Quay lại
          </button>
        </div>
      </header>

      <main className="pt-16">
        {/* Hero */}
        <section className="relative min-h-[540px] overflow-hidden">
          {movie.posterUrl && (
            <img
              src={movie.posterUrl}
              alt={movie.title}
              className="absolute inset-0 h-full w-full object-cover brightness-[0.4]"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-100 via-slate-900/30 to-transparent" />

          <div className="relative max-w-7xl mx-auto px-6 py-20 flex items-end min-h-[540px]">
            <div className="max-w-3xl space-y-6">
              <div className="flex flex-wrap items-center gap-3 text-sm text-white">
                <span className="px-3 py-1 rounded-sm bg-blue-600 font-semibold">
                  {movie.active ? 'Đang chiếu' : 'Ngừng chiếu'}
                </span>
                <span className="px-2 py-1 bg-white/20 rounded text-xs font-bold">
                  {movie.ageRating}
                </span>
                {movie.genres.map((g) => (
                  <span key={g} className="text-white/70">
                    {g}
                  </span>
                ))}
              </div>

              <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white">
                {movie.title}
              </h1>
              <p className="text-white/80 text-lg leading-relaxed">{movie.description}</p>

              <div className="flex flex-wrap gap-3">
                {movie.trailerUrl && (
                  <a
                    href={movie.trailerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-colors"
                  >
                    <Play size={16} /> Xem trailer
                  </a>
                )}
                {showtimes.length > 0 && (
                  <button
                    onClick={handleBookNow}
                    className="px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors"
                  >
                    Đặt vé ngay
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Details */}
        <section className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-10">
            <div>
              <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">Nội dung phim</h2>
              <p className="text-slate-700 leading-relaxed text-lg">{movie.description}</p>
            </div>
          </div>

          <aside className="lg:col-span-4 space-y-6">
            {/* Movie meta */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-slate-400" />
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500">Ngày phát hành</p>
                  <p className="font-semibold">
                    {new Date(movie.releaseDate).toLocaleDateString('vi-VN')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-slate-400" />
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500">Thời lượng</p>
                  <p className="font-semibold">{movie.durationMinutes} phút</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Globe size={14} className="text-slate-400" />
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500">Ngôn ngữ</p>
                  <p className="font-semibold">{movie.language}</p>
                </div>
              </div>
              {movie.genres.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Thể loại</p>
                  <div className="flex flex-wrap gap-2">
                    {movie.genres.map((g) => (
                      <span
                        key={g}
                        className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Showtimes */}
            <div className="bg-slate-900 text-white rounded-xl p-6 space-y-4">
              <h3 className="font-semibold">Suất chiếu</h3>
              {showtimes.length === 0 ? (
                <p className="text-sm text-white/60">Chưa có suất chiếu nào.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {showtimes.map((st) => (
                    <button
                      key={st.id}
                      onClick={() => handleBookShowtime(st)}
                      className="text-left px-4 py-3 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      <span className="block text-sm font-semibold">
                        {formatShowtime(st.startTime)}
                      </span>
                      <span className="block text-xs text-white/60 mt-0.5">
                        {formatVND(parseVND(st.basePrice))} / ghế
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
};
