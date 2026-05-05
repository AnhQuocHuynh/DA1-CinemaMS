import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ArrowLeft, Star, Play } from 'lucide-react';

// Mock movie data - in a real app, this would come from an API
const mockMovies: Record<string, any> = {
  'm1': {
    id: 'm1',
    title: 'NEON ARCHITECT',
    genre: 'Sci-Fi / Thriller',
    duration: '2h 45m',
    rating: 8.9,
    imdbRating: '8.9 IMDB',
    status: 'Now Showing',
    backdropImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDCUmXd_54LHNvU1Sayel0ekXfd9cEBEnMsu34V6tl2DQhmTHWmBtElrOa27AkZS38he7C6u_P0h8RGUONQqNn3SZgJ9omWrpATchRegJ7nNi3aAZ-jOEmS3XPaJRWI_QL6NcaPtJH2e70ZsmkSQZ-BIjt53s4xDTZiAx4zZbQo1XtT4M5DqJnlXOepRYaH7pHCHwd3C0ouADJ0ZQ9w897AB5j7s_DxxsfWcHztdXj_qrKdGwECOE1R0La4uUUlZp5Sn1iyHmd36DI',
    synopsis: 'In a world where reality is constructed through digital blueprints, a rogue architect discovers a flaw in the master code that could rewrite human history. As the boundaries between the physical and the virtual dissolve, he must navigate a labyrinth of corporate espionage and neon-drenched nightmares to save the last remnants of human consciousness.',
    director: 'Christopher Nolan',
    studio: 'Architect Films / Warner Bros.',
    contentRating: 'PG-13',
    contentWarning: 'Thematic elements and intense action sequences.',
    releaseDate: 'Nov 24, 2024',
    language: 'English, Japanese',
    format: 'IMAX 70mm, Digital',
    cast: [
      {
        name: 'Julian Vane',
        role: 'The Architect',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCKWyk1nPtJuXmZqxUaK2ytyuP00kgis7HAFI0vt8LJ2jvAZCKah50NxS15Iaun063J3t5uJrc0Qe-XVzPSwnHozTa50PX25l6-ugEYJmIe1qZrbeej9JFzDQEuGzuFUrklH9FPOBKU8pP13fA97zGBTd1laWDZLbi0u225MSux3UODMlQ1bqbksdrTwuuJnnsX4l3SFfM8xxxqcPhQ5i963GV57egY3dMNMiiykPb_U8gx2ciBLfegAuZiQ4xA2iZVH4LoG9Ns1_U',
        featured: true
      },
      {
        name: 'Elena Kross',
        role: 'Chief Engineer',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCaVdDFJ58MgxRPLHXS8kCzL2smb2XR2dW8VI0TGmL87da9ayrS9ndOFykEwClh0fIiJvzAYSfPAE20zBq6zw3GUcqBDauXt4MhYc7ETXDO1P0ZYDsAmj22Dtpqh5Q5wr4SkzzGOKAeRZLZlVzyAZFJuGB22NREZMFcna12MlG6G8dEt92P_4hH7D5Flfg4U7VxwLrxbwO_Y_tVyeYS0wnk24eoBlRQoimlbwej1BWSLLUy-fELdF5cz03wKWKXQOkLUC4ClWTDkt8',
        featured: true
      },
      {
        name: 'Marcus Thorne',
        role: '',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC5OxQHMhK3ktORB0rx_utEypieXlLQiEHAe_1XhdLq-arKQkc69oQWBdAomGRtJIDMiRJam6rhtnjnMpJHKLVjlBAEUwLba82KZoTaR1IUCgpNq3dfkomtZL7om6w5CguogUi-m_g2IFV_LD4bmBrlTLZy7EV8l5C9VPiXgzQUZUTi0GlJuV9YWfd7h0_QuwZwmu-lSvelc6_jhOJpY6esdGYaABrJ-lxD4yKfEBEOYotIX8I220wWkDIThgeleEDQMjR6rDTlLkQ',
        featured: false
      },
      {
        name: 'Leo Flux',
        role: '',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCbFCO5460nps8MlXjb80Xa3OaI92E3l9bQksyjdNrTKl7B5AColm4ZoR6MDZEfwSgKI5vhRED2vjSYmzngaloHAUK1WAiuCovxyWu0ubeob2Z9Vf-8q4Db-l1lsAmCEDcIJj6cf239vFnn-ArG8h_M6FFH889zY50lm3qyUJlGhUEMyWZlSqd8CIvvZsSX8UOuzVjzhoD24JoSWpyHZafd5Gy5Uk4UjCElfGmNMJ9BrsL8CoLtICR0rmrnPtdhTmTGr8arFWZefRM',
        featured: false
      }
    ],
    showtimes: [
      { time: '14:30', format: 'IMAX' },
      { time: '17:45', format: 'DOLBY' },
      { time: '20:15', format: 'IMAX', selected: true },
      { time: '23:00', format: '4DX' }
    ],
    media: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuANvdvUS514UNiLS5FkC4RbZ5qeceUWyjWbDWc5I7VWri1UFbIciUqeUwmo0KjLO5kqVURjLzbGwGekRXl08E3wKPe4ZtfWAKv6VaYi-_o5-qVAkcNsoBoC_BryRwLM6TAsfzUc22a89Q9snB5u940wQHJl3ylQ7UpgwjDqIwEwdokhGMnYOUBNBRJ9JI8CeJC6t0YkUxXdVUxT2Wg_eeCxfV-Vfc6Zd-l5YLF7473qadQdPrq7bmTrKr7EnshK79c4TAQI7X_qbLo',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDpWbfO4u7O_C90P4vADCQ4RhyoZNTaE6mVZff4Z3jjNuwBXCc7eRAf1t4_GlohCePvqsqFS2JdduOZ9MpXpxgu7EfazNCgXZU-0BCmuIIegPakS9dwxMxjjJo0ZeBwNLyG4XddI61OX17N1MDLyCxNjmnxeuNCJtVIghS1kfnwGtx24ex5wdn-Wijgv2wI5ZCsINbvDlo1Qp9yXn7KASPNzmXbwUPgi4FvojsjszydnF83dukcQR3U0GhJQak_FdLhRvlfrTSGc-M',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB5-Tbj3r4w6RbOvsQJ2CL3w_asZZj23IUZRWHtMcu_ZzkGCoSxsDk0zrFSJLZKw7jbfYLXpN6gqS2nNQFIj3Se4AhZMeppobzs0oC1s6T1bnYcGIY0fFUlRKvrtiXyAGVMGS3rGZ2LtInT8pC_umqqXwBiw2SCIAs3ZuatHF5U1Qv1a-VjwiPtkBc4S35BCXcpSHnPiB3NsE5B2Ues96rHOpQbSqT5BWbZz0IFcRS8YiiDkIpUqI3TXapfxq9vdQIDu7FWTeA-ZsE'
    ]
  },
  'm2': {
    id: 'm2',
    title: 'The Last Fragment',
    genre: 'Drama',
    duration: '1h 48m',
    rating: 8.7,
    imdbRating: '8.7 IMDB',
    status: 'Now Showing',
    backdropImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDliIX8XnVSw2KuJBm5frg31Zw6qqMPaMuK4M-gq5H9XnJunqzKgKjmE2ivzuKABdxJz8SPo1LalRqDCu2AQuOjW0hyrLNu7SxOT9TSCG5d_EIyJ1EB-LcuUtns6hinhx3diJD3T-Ol7DEgQg5paSg5GykgIxpr3Ftfp5veV07qv8_84zv2_aCOoT1G3sFjojeSvQsYjS1K_GrBmLz3yrP97FS1dijWUNyEROBM8X7lAjsl3HGvs_2n0Ws45-klvQeezwaaTCzHi2U',
    synopsis: 'A poignant story of discovery, loss, and redemption as a woman uncovers fragments of her past that reshape her understanding of identity and belonging.',
    director: 'Sofia Lumière',
    studio: 'Independent Films',
    contentRating: 'PG',
    contentWarning: 'Themes of loss and grief',
    releaseDate: 'Oct 15, 2024',
    language: 'English',
    format: 'Digital',
    cast: [],
    showtimes: [
      { time: '14:00', format: 'DIGITAL' },
      { time: '16:30', format: 'DIGITAL' },
      { time: '19:00', format: 'DIGITAL' },
      { time: '21:30', format: 'DIGITAL' }
    ],
    media: []
  },
  'm3': {
    id: 'm3',
    title: 'Midnight Protocol',
    genre: 'Thriller',
    duration: '2h 05m',
    rating: 8.8,
    imdbRating: '8.8 IMDB',
    status: 'Now Showing',
    backdropImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDeyPkuK-CR77W5t_F3PCkqkJxR8qoiPRBK4Yc6u3Tb8E30Sb7qKev1gPyOec3hT5yaHj6bXxHhIybzYnBEAqTPQMKudXXd_YF4cp7dQuU1x5eud4bZai8Ha0ndYQCKLZSclzCy9m5w-zLpkeP9mP09WYHsx2aYNWulkapyuOBVCbA3SZyw5wQJ8c8xQf5nwPBPJ5Zytkz5C4ExpGxs1OjAT3cKpO6xAzVng2VLZqIkjRl0jhR6Vf1bw7WJ_73hhE59mplWHflmkaQ',
    synopsis: 'A high-stakes thriller where a secret operative must prevent a catastrophic protocol from being unleashed on the world.',
    director: 'James Mitchell',
    studio: 'Universal Pictures',
    contentRating: 'R',
    contentWarning: 'Violence and intense scenes',
    releaseDate: 'Sep 01, 2024',
    language: 'English',
    format: 'IMAX, Digital',
    cast: [],
    showtimes: [
      { time: '15:00', format: 'IMAX' },
      { time: '18:00', format: 'DIGITAL' },
      { time: '21:00', format: 'IMAX' }
    ],
    media: []
  }
};

export const MovieDetails: React.FC = () => {
  const { movieId } = useParams<{ movieId: string }>();
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [showTrailerModal, setShowTrailerModal] = useState(false);

  const movie = movieId ? mockMovies[movieId] : null;

  if (!movie) {
    return (
      <div className="min-h-screen bg-surface pt-16 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-on-surface mb-4">Movie Not Found</h1>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-blue-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const handleReserve = () => {
    if (!token) {
      navigate('/login');
      return;
    }
    // TODO: Navigate to seat selection
    console.log('Reserve seats for movie:', movie.id);
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md shadow-sm h-16 flex justify-between items-center px-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-900" />
          </button>
          <span className="text-xl font-bold tracking-tighter text-slate-900">CinemaArchitect</span>
        </div>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold transition-all hover:bg-blue-700"
        >
          Browse Movies
        </button>
      </header>

      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative h-[716px] w-full overflow-hidden">
          <div className="absolute inset-0">
            <img
              alt="Movie backdrop"
              src={movie.backdropImage}
              className="w-full h-full object-cover grayscale-[20%] brightness-[40%] scale-105"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent"></div>
          <div className="relative h-full max-w-7xl mx-auto px-8 flex flex-col justify-end pb-16">
            <div className="flex items-center gap-4 mb-6">
              <span className="px-3 py-1 bg-primary text-white text-[10px] font-bold uppercase tracking-widest rounded-sm">
                {movie.status}
              </span>
              <span className="flex items-center gap-1 text-white text-sm font-medium">
                <Star className="w-4 h-4 fill-current" /> {movie.imdbRating}
              </span>
              <span className="text-white/60 text-sm font-medium">{movie.genre} • {movie.duration}</span>
            </div>
            <h1 className="text-7xl font-black text-white tracking-tighter mb-8 leading-[0.9]">
              {movie.title}
            </h1>
            <div className="flex gap-4">
              <button
                onClick={() => setShowTrailerModal(true)}
                className="group flex items-center gap-3 px-8 py-4 bg-white text-on-surface font-bold rounded-lg transition-all hover:bg-surface-container-low active:scale-95"
              >
                <Play className="w-5 h-5 fill-current" />
                Watch Trailer
              </button>
              <button
                onClick={handleReserve}
                className="px-8 py-4 bg-primary text-white font-bold rounded-lg transition-all shadow-xl shadow-primary/20 hover:-translate-y-0.5 active:scale-95"
              >
                Book Tickets
              </button>
            </div>
          </div>
        </section>

        {/* Content Grid */}
        <section className="max-w-7xl mx-auto px-8 py-12">
          <div className="grid grid-cols-12 gap-12">
            {/* Left Column: Details */}
            <div className="col-span-12 lg:col-span-8 space-y-12">
              {/* Synopsis */}
              <div className="space-y-4">
                <h2 className="text-xs uppercase font-bold tracking-[0.2em] text-secondary">The Narrative</h2>
                <p className="text-xl leading-relaxed text-on-surface/80 font-light">{movie.synopsis}</p>
              </div>

              {/* Cast Grid */}
              {movie.cast && movie.cast.length > 0 && (
                <div className="space-y-6">
                  <div className="flex justify-between items-end">
                    <h2 className="text-xs uppercase font-bold tracking-[0.2em] text-secondary">The Ensemble</h2>
                    <button className="text-primary text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all">
                      Full Cast
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {movie.cast.map((castMember: any, idx: number) => (
                      <div
                        key={idx}
                        className={`relative overflow-hidden rounded-xl bg-surface-container-low ${
                          idx === 0 ? 'col-span-2 row-span-2 aspect-square' : 'aspect-video'
                        }`}
                      >
                        <img
                          alt={castMember.name}
                          src={castMember.image}
                          className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                        />
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                          <p className="text-white font-bold">{castMember.name}</p>
                          {castMember.role && <p className="text-white/60 text-xs uppercase tracking-tighter">{castMember.role}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Metadata & Sidebar */}
            <div className="col-span-12 lg:col-span-4 space-y-8">
              {/* Stats Card */}
              <div className="p-8 bg-surface-container-low rounded-xl space-y-6">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Director</span>
                  <span className="text-lg font-bold">{movie.director}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Studio</span>
                  <span className="text-lg font-bold">{movie.studio}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Rating</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 border border-outline-variant text-[10px] font-bold rounded">
                      {movie.contentRating}
                    </span>
                    <span className="text-sm text-on-surface/60">{movie.contentWarning}</span>
                  </div>
                </div>
              </div>

              {/* Showtime Quick Select */}
              <div className="p-8 bg-inverse-surface text-inverse-on-surface rounded-xl space-y-6">
                <h3 className="text-sm font-bold tracking-tight">Today's Showtimes</h3>
                <div className="grid grid-cols-2 gap-2">
                  {movie.showtimes.map((showtime: any, idx: number) => (
                    <button
                      key={idx}
                      className={`py-3 px-4 transition-colors text-xs font-bold rounded-lg border ${
                        showtime.selected
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white/10 hover:bg-white/20 border-white/5'
                      }`}
                    >
                      {showtime.time} {showtime.format}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleReserve}
                  className="w-full py-4 bg-primary text-white font-black text-sm uppercase tracking-widest rounded-lg transition-transform active:scale-95 shadow-2xl shadow-primary/40 hover:bg-blue-700"
                >
                  Reserve Seat Map
                </button>
              </div>

              {/* Additional Details */}
              <div className="px-4 space-y-4">
                <div className="flex justify-between py-3 border-b border-outline-variant/10 text-sm">
                  <span className="text-secondary">Release Date</span>
                  <span className="font-medium">{movie.releaseDate}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-outline-variant/10 text-sm">
                  <span className="text-secondary">Language</span>
                  <span className="font-medium">{movie.language}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-outline-variant/10 text-sm">
                  <span className="text-secondary">Format</span>
                  <span className="font-medium">{movie.format}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Media Gallery */}
        {movie.media && movie.media.length > 0 && (
          <section className="bg-surface-container-low py-20 mt-12">
            <div className="max-w-7xl mx-auto px-8 space-y-8">
              <div className="flex justify-between items-end">
                <h2 className="text-3xl font-black tracking-tighter">BEYOND THE LENS</h2>
                <span className="text-secondary font-medium">{movie.media.length} Media Assets</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {movie.media.map((image: string, idx: number) => (
                  <div key={idx} className="aspect-video bg-surface-container-lowest rounded-xl overflow-hidden group cursor-pointer">
                    <img
                      alt="Gallery"
                      src={image}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Trailer Modal */}
      {showTrailerModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-on-surface/95 backdrop-blur-xl">
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
            <button
              onClick={() => setShowTrailerModal(false)}
              className="absolute top-6 right-6 z-10 w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all"
            >
              ✕
            </button>
            <div className="w-full h-full flex items-center justify-center bg-slate-900">
              <Play className="w-24 h-24 text-primary fill-current" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
