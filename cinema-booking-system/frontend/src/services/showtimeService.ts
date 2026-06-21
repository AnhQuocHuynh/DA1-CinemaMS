import apiClient from './authService';
import { ShowtimeResponse } from '../types/showtime';

// Showtime Service — real API calls
export const showtimeService = {
  /** GET /showtimes/movie/{movieId} */
  getShowtimes: async (movieId: number): Promise<ShowtimeResponse[]> => {
    const response = await apiClient.get<{ success: boolean; data: ShowtimeResponse[] }>(
      `/showtimes/movie/${movieId}`
    );
    return response.data?.data ?? [];
  },

  /** GET /showtimes/{id} */
  getShowtime: async (showtimeId: number | string): Promise<ShowtimeResponse> => {
    const response = await apiClient.get<{ success: boolean; data: ShowtimeResponse }>(
      `/showtimes/${showtimeId}`
    );
    return response.data.data;
  },
};
