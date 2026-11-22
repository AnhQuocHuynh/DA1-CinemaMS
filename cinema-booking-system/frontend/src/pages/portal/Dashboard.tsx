import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Film, Ticket, User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { bookingService } from '../../services/bookingService';
import { movieService } from '../../services/movieService';
import genericPoster from '../../resources/generic_movie_poster.png';
import { useTranslation } from 'react-i18next';

interface Movie {
  id: number;
  title: string;
  genre: string;
  rating: number;
  poster: string;
}

interface Booking {
  id: string;
  movieTitle: string;
  date: string;
  status: string;
  seats: string[];
}

export const UserDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const userId = user?.id ? (typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10)) : 0;
        const [moviesData, rawTickets] = await Promise.all([
          movieService.getMovies(),
          userId ? bookingService.getUserTickets(userId) : Promise.resolve([]),
        ]);
        // Map API ticket shape to local Booking interface for display
        const bookingsData: Booking[] = rawTickets.map((t) => ({
          id: t.ticketCode,
          movieTitle: t.ticketCode,
          date: new Date(t.createdAt).toLocaleDateString('vi-VN'),
          status: t.status,
          seats: [],
        }));
        setMovies(moviesData as unknown as Movie[]);
        setBookings(bookingsData);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [user]);

  const handleLogout = () => {
    console.log('👤 [USER] Logout clicked');
    logout();
    navigate('/login');
  };

  const handleBookMovie = (movieId: number) => {
    console.log('🎫 [USER] Booking movie:', movieId);
    navigate(`/user/booking/${movieId}`);
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/80 backdrop-blur-md shadow-sm h-16 flex justify-between items-center px-8">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tighter text-on-surface">CinemaArchitect</span>
          <div className="hidden md:flex space-x-6">
            <a href="#movies" className="text-on-surface-variant hover:text-on-surface transition-colors font-medium text-sm">
              {t('common.movies')}
            </a>
            <a href="#bookings" className="text-on-surface-variant hover:text-on-surface transition-colors font-medium text-sm">
              {t('dashboard.myBookings')}
            </a>
            <a href="#profile" className="text-on-surface-variant hover:text-on-surface transition-colors font-medium text-sm">
              {t('dashboard.profile')}
            </a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-on-surface-variant">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="bg-error text-on-error px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-all flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            {t('dashboard.logout')}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Welcome Section */}
          <section className="mb-12">
            <h1 className="text-4xl font-bold text-on-surface mb-2">{t('dashboard.welcome')}, {user?.email?.split('@')[0]}! 🎬</h1>
            <p className="text-on-surface-variant">{t('dashboard.subtitle')}</p>
          </section>

          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-on-surface-variant">{t('dashboard.loading')}</p>
            </div>
          ) : (
            <>
              {/* Available Movies Section */}
              <section id="movies" className="mb-12">
                <h2 className="text-2xl font-bold text-on-surface mb-6 flex items-center gap-2">
                  <Film className="w-6 h-6 text-primary" />
                  {t('dashboard.availableMovies')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {movies.map((movie) => (
                    <div key={movie.id} className="bg-surface-container rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                      <img
                        src={movie.poster || genericPoster}
                        alt={movie.title}
                        className="w-full h-64 object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = genericPoster;
                        }}
                      />
                      <div className="p-4">
                        <h3 className="font-bold text-on-surface mb-1 line-clamp-2">{movie.title}</h3>
                        <p className="text-sm text-on-surface-variant mb-2">{movie.genre}</p>
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-sm font-bold text-primary">⭐ {movie.rating}/10</span>
                        </div>
                        <button
                          onClick={() => handleBookMovie(movie.id)}
                          className="w-full py-2 bg-primary text-on-primary rounded-lg font-semibold text-sm hover:opacity-90 transition-all"
                        >
                          {t('dashboard.bookNow')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* My Bookings Section */}
              <section id="bookings">
                <h2 className="text-2xl font-bold text-on-surface mb-6 flex items-center gap-2">
                  <Ticket className="w-6 h-6 text-primary" />
                  {t('dashboard.myBookings')} ({bookings.length})
                </h2>
                {bookings.length > 0 ? (
                  <div className="grid gap-4">
                    {bookings.map((booking) => (
                      <div key={booking.id} className="bg-surface-container rounded-lg p-6 flex justify-between items-center border border-outline-variant/30">
                        <div className="flex-1">
                          <h3 className="font-bold text-on-surface mb-2">{booking.movieTitle}</h3>
                          <p className="text-sm text-on-surface-variant mb-1">{t('dashboard.date')}: {booking.date}</p>
                          <p className="text-sm text-on-surface-variant">{t('dashboard.seats')}: {booking.seats.join(', ')}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-block px-3 py-1 bg-success-container text-on-success-container rounded-full text-sm font-semibold">
                            {booking.status}
                          </span>
                          <button className="mt-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm hover:opacity-90 transition-all">
                            {t('dashboard.viewDetails')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-surface-container rounded-lg p-8 text-center">
                    <Ticket className="w-12 h-12 text-outline-variant mx-auto mb-4 opacity-50" />
                    <p className="text-on-surface-variant mb-4">{t('dashboard.noBookings')}</p>
                    <p className="text-sm text-on-surface-variant">{t('dashboard.startBooking')}</p>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      {/* Mobile Navigation */}
      <footer className="md:hidden fixed bottom-0 w-full bg-surface-container-lowest/80 backdrop-blur-md flex justify-around items-center h-16 z-50">
        <a href="#movies" className="flex flex-col items-center text-primary text-center">
          <Film className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">{t('common.movies')}</span>
        </a>
        <a href="#bookings" className="flex flex-col items-center text-on-surface-variant text-center hover:text-primary">
          <Ticket className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">{t('dashboard.myBookings')}</span>
        </a>
        <a href="#profile" className="flex flex-col items-center text-on-surface-variant text-center hover:text-primary">
          <User className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">{t('dashboard.profile')}</span>
        </a>
      </footer>
    </div>
  );
};
