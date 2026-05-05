export interface MovieShowtime {
  id: string;
  startTime: string;
  theaterName: string;
  format: 'IMAX' | 'DOLBY' | '4DX' | '2D';
  price: number;
}

export interface Movie {
  id: string;
  title: string;
  genre: string;
  durationMinutes: number;
  rating: number;
  synopsis: string;
  releaseDate: string;
  language: string;
  posterUrl: string;
  backdropUrl: string;
  cast: Array<{ name: string; role: string; imageUrl: string }>;
  showtimes: MovieShowtime[];
}
