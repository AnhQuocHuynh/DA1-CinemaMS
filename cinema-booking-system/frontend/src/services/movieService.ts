import apiClient from '../lib/apiClient';

export interface MovieResponse {
  id: number;
  title: string;
  description: string;
  durationMinutes: number;
  releaseDate: string;
  ageRating: string;
  posterUrl: string;
  trailerUrl: string;
  language: string;
  active: boolean;
  genres: string[];
  createdAt: string;
  updatedAt: string;
}

// Movie Service
export const movieService = {
  /** GET /movies */
  getMovies: async (): Promise<MovieResponse[]> => {
    const response = await apiClient.get<{ success: boolean; data: MovieResponse[] }>('/movies');
    return response.data?.data ?? [];
  },

  /** GET /movies/{id} */
  getMovieById: async (id: number | string): Promise<MovieResponse> => {
    const response = await apiClient.get<{ success: boolean; data: MovieResponse }>(`/movies/${id}`);
    return response.data.data;
  },

  /** GET /genres */
  getGenres: async (): Promise<{ id: number; name: string }[]> => {
    const response = await apiClient.get<{ success: boolean; data: { id: number; name: string }[] }>('/genres');
    return response.data.data;
  },

  /** POST /genres */
  createGenre: async (name: string): Promise<{ id: number; name: string }> => {
    const response = await apiClient.post<{ success: boolean; data: { id: number; name: string } }>('/genres', { name });
    return response.data.data;
  },

  /** DELETE /genres/{id} */
  deleteGenre: async (id: number): Promise<void> => {
    await apiClient.delete(`/genres/${id}`);
  },
};
