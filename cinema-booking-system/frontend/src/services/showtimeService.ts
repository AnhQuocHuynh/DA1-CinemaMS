// TODO: Migrate to src/lib/apiClient.ts
import apiClient from './authService';
import { ShowtimeResponse } from '../types/showtime';
import { CreateShowtimePayload } from '../types/schedule';

// Showtime Service — real API calls
export const showtimeService = {
  /** GET /showtimes/movie/{movieId} */
  getShowtimes: async (movieId: number): Promise<ShowtimeResponse[]> => {
    const response = await apiClient.get<{ success: boolean; data: ShowtimeResponse[] }>(
      `/showtimes/movie/${movieId}`
    );
    return response.data?.data ?? [];
  },

  /** GET /showtimes/event/{eventId} */
  getShowtimesByEvent: async (eventId: number): Promise<ShowtimeResponse[]> => {
    const response = await apiClient.get<{ success: boolean; data: ShowtimeResponse[] }>(
      `/showtimes/event/${eventId}`
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

  /** GET /showtimes/room/{roomId} — all showtimes for a room */
  getShowtimesByRoom: async (roomId: number): Promise<ShowtimeResponse[]> => {
    const response = await apiClient.get<{ success: boolean; data: ShowtimeResponse[] }>(
      `/showtimes/room/${roomId}`
    );
    return response.data?.data ?? [];
  },

  /** POST /showtimes — create a single showtime */
  createShowtime: async (payload: CreateShowtimePayload): Promise<ShowtimeResponse> => {
    const response = await apiClient.post<{ success: boolean; data: ShowtimeResponse }>(
      '/showtimes',
      payload
    );
    return response.data.data;
  },

  /** DELETE /showtimes/{id} */
  deleteShowtime: async (showtimeId: number | string): Promise<void> => {
    await apiClient.delete(`/showtimes/${showtimeId}`);
  },
};
