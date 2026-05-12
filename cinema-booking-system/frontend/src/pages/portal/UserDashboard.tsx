import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Film, Ticket, User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { bookingService } from '../../services/bookingService';
import { movieService } from '../../services/movieService';

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
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [moviesData, bookingsData] = await Promise.all([
          movieService.getMovies(),
          bookingService.getUserBookings(),
        ]);
        setMovies(moviesData);
        setBookings(bookingsData);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleLogout = () => {
    console.log('👤 [USER] Logout clicked');
    logout();
    navigate('/');
  };

  const handleBookMovie = (movieId: number) => {
    console.log('🎫 [USER] Booking movie:', movieId);
    navigate(`/user/booking/${movieId}`);
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md shadow-sm h-16 flex justify-between items-center px-8">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tighter text-slate-900">CinemaArchitect</span>
          <div className="hidden md:flex space-x-6">
            <a href="#movies" className="text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm">
              Movies
            </a>
            <a href="#bookings" className="text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm">
              My Bookings
            </a>
            <a href="#profile" className="text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm">
              Profile
            </a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="bg-error text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-red-700 transition-all flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Welcome Section */}
          <section className="mb-12">
            <h1 className="text-4xl font-bold text-on-surface mb-2">Welcome, {user?.email?.split('@')[0]}! 🎬</h1>
            <p className="text-on-surface-variant">Discover and book your next favorite movie experience</p>
          </section>

          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-on-surface-variant">Loading content...</p>
            </div>
          ) : (
            <>
              {/* Available Movies Section */}
              <section id="movies" className="mb-12">
                <h2 className="text-2xl font-bold text-on-surface mb-6 flex items-center gap-2">
                  <Film className="w-6 h-6 text-primary" />
                  Available Movies
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {movies.map((movie) => (
                    <div key={movie.id} className="bg-surface-container rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                      <img
                        src={movie.poster}
                        alt={movie.title}
                        className="w-full h-64 object-cover"
                      />
                      <div className="p-4">
                        <h3 className="font-bold text-on-surface mb-1 line-clamp-2">{movie.title}</h3>
                        <p className="text-sm text-on-surface-variant mb-2">{movie.genre}</p>
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-sm font-bold text-primary">⭐ {movie.rating}/10</span>
                        </div>
                        <button
                          onClick={() => handleBookMovie(movie.id)}
                          className="w-full py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-all"
                        >
                          Book Now
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
                  My Bookings ({bookings.length})
                </h2>
                {bookings.length > 0 ? (
                  <div className="grid gap-4">
                    {bookings.map((booking) => (
                      <div key={booking.id} className="bg-surface-container rounded-lg p-6 flex justify-between items-center border border-outline-variant/30">
                        <div className="flex-1">
                          <h3 className="font-bold text-on-surface mb-2">{booking.movieTitle}</h3>
                          <p className="text-sm text-on-surface-variant mb-1">Date: {booking.date}</p>
                          <p className="text-sm text-on-surface-variant">Seats: {booking.seats.join(', ')}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                            {booking.status}
                          </span>
                          <button className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-blue-700 transition-all">
                            View Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-surface-container rounded-lg p-8 text-center">
                    <Ticket className="w-12 h-12 text-outline-variant mx-auto mb-4 opacity-50" />
                    <p className="text-on-surface-variant mb-4">No bookings yet</p>
                    <p className="text-sm text-on-surface-variant">Start by booking a movie from the available options above!</p>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      {/* Mobile Navigation */}
      <footer className="md:hidden fixed bottom-0 w-full bg-white/80 backdrop-blur-md flex justify-around items-center h-16 z-50">
        <a href="#movies" className="flex flex-col items-center text-primary text-center">
          <Film className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Movies</span>
        </a>
        <a href="#bookings" className="flex flex-col items-center text-slate-500 text-center hover:text-primary">
          <Ticket className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Bookings</span>
        </a>
        <a href="#profile" className="flex flex-col items-center text-slate-500 text-center hover:text-primary">
          <User className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Profile</span>
        </a>
      </footer>
    </div>
  );
};

