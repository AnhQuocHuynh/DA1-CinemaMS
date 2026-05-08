import { Movie } from '../types/movie';

export const movies: Movie[] = [
  {
    id: 'neon-architect',
    title: 'Neon Architect',
    genre: 'Sci-Fi',
    durationMinutes: 165,
    rating: 8.9,
    synopsis:
      'A rogue architect discovers a flaw in the master code that powers reality and fights to stop a corporation from rewriting human memory.',
    releaseDate: '2024-11-24',
    language: 'English, Japanese',
    posterUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBS1-5VF26AyT4Mmta6mEKLRyizzjxN2cqZ69d4EYzEUaL891KNq8aXQ8sDUrquDjKZJAC1vx6fvzyVGwnL8WppNuR93zi9EVtAHHpENnKwvL9UsBgKcAxZys1EcYFwMzWl3uuMkj1VsMEJjlmRSo8sMeiLyBkfvD8G4CF5qF94laC2alt-6LZaqPzDfuoZ4kHoYOj01EQSCgsv6tMuKeNJYlFwdfIV2T1-Hf1yFu8WPRy5yZSnoGBdXZTI4_pS1ks4Oy_sZTMyt8k',
    backdropUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDCUmXd_54LHNvU1Sayel0ekXfd9cEBEnMsu34V6tl2DQhmTHWmBtElrOa27AkZS38he7C6u_P0h8RGUONQqNn3SZgJ9omWrpATchRegJ7nNi3aAZ-jOEmS3XPaJRWI_QL6NcaPtJH2e70ZsmkSQZ-BIjt53s4xDTZiAx4zZbQo1XtT4M5DqJnlXOepRYaH7pHCHwd3C0ouADJ0ZQ9w897AB5j7s_DxxsfWcHztdXj_qrKdGwECOE1R0La4uUUlZp5Sn1iyHmd36DI',
    cast: [
      {
        name: 'Julian Vane',
        role: 'The Architect',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCKWyk1nPtJuXmZqxUaK2ytyuP00kgis7HAFI0vt8LJ2jvAZCKah50NxS15Iaun063J3t5uJrc0Qe-XVzPSwnHozTa50PX25l6-ugEYJmIe1qZrbeej9JFzDQEuGzuFUrklH9FPOBKU8pP13fA97zGBTd1laWDZLbi0u225MSux3UODMlQ1bqbksdrTwuuJnnsX4l3SFfM8xxxqcPhQ5i963GV57egY3dMNMiiykPb_U8gx2ciBLfegAuZiQ4xA2iZVH4LoG9Ns1_U',
      },
      {
        name: 'Elena Kross',
        role: 'Chief Engineer',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCaVdDFJ58MgxRPLHXS8kCzL2smb2XR2dW8VI0TGmL87da9ayrS9ndOFykEwClh0fIiJvzAYSfPAE20zBq6zw3GUcqBDauXt4MhYc7ETXDO1P0ZYDsAmj22Dtpqh5Q5wr4SkzzGOKAeRZLZlVzyAZFJuGB22NREZMFcna12MlG6G8dEt92P_4hH7D5Flfg4U7VxwLrxbwO_Y_tVyeYS0wnk24eoBlRQoimlbwej1BWSLLUy-fELdF5cz03wKWKXQOkLUC4ClWTDkt8',
      },
      {
        name: 'Marcus Thorne',
        role: 'Director',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuC5OxQHMhK3ktORB0rx_utEypieXlLQiEHAe_1XhdLq-arKQkc69oQWBdAomGRtJIDMiRJam6rhtnjnMpJHKLVjlBAEUwLba82KZoTaR1IUCgpNq3dfkomtZL7om6w5CguogUi-m_g2IFV_LD4bmBrlTLZy7EV8l5C9VPiXgzQUZUTi0GlJuV9YWfd7h0_QuwZwmu-lSvelc6_jhOJpY6esdGYaABrJ-lxD4yKfEBEOYotIX8I220wWkDIThgeleEDQMjR6rDTlLkQ',
      },
    ],
    showtimes: [
      { id: 'na-1', startTime: '14:30', theaterName: 'HQ Terminal - IMAX Hall 1', format: 'IMAX', price: 14.5 },
      { id: 'na-2', startTime: '17:45', theaterName: 'HQ Terminal - Dolby Hall 2', format: 'DOLBY', price: 13.5 },
      { id: 'na-3', startTime: '20:15', theaterName: 'HQ Terminal - IMAX Hall 1', format: 'IMAX', price: 15.0 },
    ],
  },
  {
    id: 'beyond-the-void',
    title: 'Beyond the Void',
    genre: 'Sci-Fi',
    durationMinutes: 135,
    rating: 4.9,
    synopsis: 'A pilot crew enters a collapsing wormhole to retrieve a signal from a lost colony at the edge of mapped space.',
    releaseDate: '2025-01-05',
    language: 'English',
    posterUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC5FrORXUnBGOod1sx1irYknxP7RUwVZ7eEYEL6P7VverQFdwufm5dEXDNyoGY4x4oZpKjuOpmvWz55aDsBkAlzS70q8WDVUo39Kqq-DOYRIA5BPyP4V63Yy6mMTTbxcUcdlShfM51eaPtplIjiYxFQ2fyOAXiWkapyzHvi9g3DxVhZnRDKWZ5SEwxE30oaiKWYRTfuT-dXxSRTf_NF3FiOToPhc36JeD_agZp8OBB1SJv4lLVc5J7oHqkLS9a90gRGG0C-cxjfogE',
    backdropUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAwI-ICHDVmo6tktU6q7yRY-lJs6IEjJvXmX6xSGHGQUpzvZxQByuXw0PAuFbM28e1JnTawyq7bXjntEJHIIJZiz4FkEBy-VeklxcYzpsnShaR3JV86bBKBnK1GTNN0Ix5x7gCjmL4cCnxguxwoCoXfhDpo8c9pnlsZS6b9yF0_iXXN90ntaTUgpnS-jOrN2BvzY0f3JQqFAHXnvzZFpmsHPTgO_u96qViayYSc9knv50PCMZQz-qv4T5MTQA5L7yCPE1rS8Wsj2oA',
    cast: [],
    showtimes: [
      { id: 'bv-1', startTime: '12:40', theaterName: 'Grand Arch Plaza - Room 5', format: '2D', price: 12.0 },
      { id: 'bv-2', startTime: '16:20', theaterName: 'The Blueprint IMAX', format: 'IMAX', price: 15.5 },
    ],
  },
  {
    id: 'the-last-fragment',
    title: 'The Last Fragment',
    genre: 'Drama',
    durationMinutes: 108,
    rating: 4.7,
    synopsis: 'Two siblings rebuild their family archive and uncover a truth that changes their city forever.',
    releaseDate: '2025-02-14',
    language: 'English',
    posterUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCZLc-UxYVw3zj6sAWq33Li-077GFW4c9kAgPXcGNOmJS18Bd2633ZE3vLEgS7-gcU5az0CdKgv326XbttW0HdcPGw2YARvWLD5W_rcw7MXYyWdxOP0mCOeBJfzPY5JsGb2YT-l--glrGlWpaB1Lw98W3ZZh38rhCe7cWUNoJ6PVuXmvNHOBitdabZ7YKu_43uc4oVA2m43xhGvAPN7ZqG3VLMeSAqYMmMHQsrf0r7QHMF6KTqa95YQd_GkErNoCFCrE6ODMESAfbA',
    backdropUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuANvdvUS514UNiLS5FkC4RbZ5qeceUWyjWbDWc5I7VWri1UFbIciUqeUwmo0KjLO5kqVURjLzbGwGekRXl08E3wKPe4ZtfWAKv6VaYi-_o5-qVAkcNsoBoC_BryRwLM6TAsfzUc22a89Q9snB5u940wQHJl3ylQ7UpgwjDqIwEwdokhGMnYOUBNBRJ9JI8CeJC6t0YkUxXdVUxT2Wg_eeCxfV-Vfc6Zd-l5YLF7473qadQdPrq7bmTrKr7EnshK79c4TAQI7X_qbLo',
    cast: [],
    showtimes: [
      { id: 'lf-1', startTime: '13:15', theaterName: 'Downtown Studio - Theater 3', format: '2D', price: 11.0 },
      { id: 'lf-2', startTime: '19:30', theaterName: 'Downtown Studio - Theater 3', format: 'DOLBY', price: 13.0 },
    ],
  },
  {
    id: 'midnight-protocol',
    title: 'Midnight Protocol',
    genre: 'Thriller',
    durationMinutes: 125,
    rating: 4.8,
    synopsis: 'An analyst races to decode a citywide blackout protocol before midnight resets every identity record.',
    releaseDate: '2025-03-20',
    language: 'English',
    posterUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCrOpNuKtdmI-aZx4rawdlhJjwO0WToAw9TcnPuGhCoYkYX9GXgMftmvy24o5WIL3DlvxDesqn3d-ztwk7Wc6yLHO2K7nPoA3WOxtQWeudwwI5VNgSzm4EnZ4p-_arZlT7RaM1htnllSCgGmVoWj_G1kfrSCcZoAO-uh1HZ1HoaryGcETWA-FJn1_sBYeKYkc4Pi2cbQKGW7iTsYT2h-u59WdVgMkPRD2q6q8KdG6nb3UYmubqVoK8CCjNiDw_8Wm_B15SNnrvOVe4',
    backdropUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDpWbfO4u7O_C90P4vADCQ4RhyoZNTaE6mVZff4Z3jjNuwBXCc7eRAf1t4_GlohCePvqsqFS2JdduOZ9MpXpxgu7EfazNCgXZU-0BCmuIIegPakS9dwxMxjjJo0ZeBwNLyG4XddI61OX17N1MDLyCxNjmnxeuNCJtVIghS1kfnwGtx24ex5wdn-Wijgv2wI5ZCsINbvDlo1Qp9yXn7KASPNzmXbwUPgi4FvojsjszydnF83dukcQR3U0GhJQak_FdLhRvlfrTSGc-M',
    cast: [],
    showtimes: [
      { id: 'mp-1', startTime: '18:00', theaterName: 'The Blueprint IMAX', format: '4DX', price: 16.0 },
      { id: 'mp-2', startTime: '22:10', theaterName: 'The Blueprint IMAX', format: '4DX', price: 16.0 },
    ],
  },
  {
    id: 'skyward-odyssey',
    title: 'Skyward Odyssey',
    genre: 'Animation',
    durationMinutes: 92,
    rating: 4.5,
    synopsis: 'A floating island explorer follows a map written in cloud currents to reunite scattered sky cities.',
    releaseDate: '2025-04-01',
    language: 'English',
    posterUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA3iRcKxCpfbAzDyiIU3Fgi0VVmiqwt2oA5VNhFcM3wrYwydJpo1AwJEfRzTkjrzsFVh5UMiMtu3jfNJIL-p5rN8q8jAeyD4gQJiQjGoBtUPUJngZXc-8k1xRfawbH2oDYWj1INjCs2Cx2KQhWUlOcmyaM425KsRWeB8HreIxc2mLKYS-H_WI-nF2EdLAQTQpdX5T7ow2Urx9o4GjPM3jCNCYD00Z796X9yM4jiVrFyS24PPxnTffxPAIPw7aHlNWrUrFqHNxUahjg',
    backdropUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAUgNoW5WWc74y2in9PGMypaatuxEWggBbEzdMACdaJk7p_m4LBbN9huSbRyA7hzUgWHYTTjkwcUanK46bXPClK4eViS_7Uz-HD7OkV-HnxJ3sy4nwQzh-yH98q8TAbwHlqaIp3mnkdw-fK6SQ6rPYZ5lbdBS4H3b_CkW4XGqhaMSnu3rByVNwW6PkyYf3874phmbnXpQBOBpiQIYRyH2bViqXSIq90dirP91ng966nkBOilijYPaiAj7BCSCiLPY7-WW9RT_vlO0w',
    cast: [],
    showtimes: [
      { id: 'so-1', startTime: '10:00', theaterName: 'Grand Arch Plaza - Family Hall', format: '2D', price: 9.0 },
      { id: 'so-2', startTime: '14:10', theaterName: 'Grand Arch Plaza - Family Hall', format: '2D', price: 9.0 },
    ],
  },
];

export const getMovieById = (movieId: string): Movie | undefined =>
  movies.find((movie) => movie.id === movieId);

export const searchMovies = (keyword: string): Movie[] => {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return movies;
  }

  return movies.filter((movie) => {
    const searchable = [movie.title, movie.genre, movie.language, movie.synopsis].join(' ').toLowerCase();
    return searchable.includes(normalizedKeyword);
  });
};

export const formatDuration = (durationMinutes: number): string => {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
};

export const calculateEndTime = (startTime: string, durationMinutes: number): string => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const startTotal = hours * 60 + minutes;
  const endTotal = startTotal + durationMinutes;
  const endHours = Math.floor((endTotal % (24 * 60)) / 60);
  const endMinutes = endTotal % 60;

  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
};
