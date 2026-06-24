import apiClient from './authService';
import type {
  ReviewResponse,
  CreateReviewRequest,
  ReviewInsightResponse,
  ReviewEligibilityResponse,
} from '../types/review';

export const reviewService = {
  /** POST /api/reviews */
  createReview: async (data: CreateReviewRequest): Promise<ReviewResponse> => {
    const response = await apiClient.post<ReviewResponse>('/reviews', data);
    return response.data;
  },

  /** GET /api/reviews/movies/{movieId} */
  getMovieReviews: async (movieId: number): Promise<ReviewResponse[]> => {
    const response = await apiClient.get<ReviewResponse[]>(`/reviews/movies/${movieId}`);
    return response.data;
  },

  /** GET /api/reviews/events/{eventId} */
  getEventReviews: async (eventId: number): Promise<ReviewResponse[]> => {
    const response = await apiClient.get<ReviewResponse[]>(`/reviews/events/${eventId}`);
    return response.data;
  },

  /** GET /api/reviews/movies/{movieId}/insight */
  getMovieInsight: async (movieId: number): Promise<ReviewInsightResponse> => {
    const response = await apiClient.get<ReviewInsightResponse>(`/reviews/movies/${movieId}/insight`);
    return response.data;
  },

  /** GET /api/reviews/events/{eventId}/insight */
  getEventInsight: async (eventId: number): Promise<ReviewInsightResponse> => {
    const response = await apiClient.get<ReviewInsightResponse>(`/reviews/events/${eventId}/insight`);
    return response.data;
  },

  /** GET /api/reviews/movies/{movieId}/eligibility?userId= */
  checkMovieEligibility: async (movieId: number, userId: number): Promise<ReviewEligibilityResponse> => {
    const response = await apiClient.get<ReviewEligibilityResponse>(
      `/reviews/movies/${movieId}/eligibility`,
      { params: { userId } }
    );
    return response.data;
  },

  /** GET /api/reviews/events/{eventId}/eligibility?userId= */
  checkEventEligibility: async (eventId: number, userId: number): Promise<ReviewEligibilityResponse> => {
    const response = await apiClient.get<ReviewEligibilityResponse>(
      `/reviews/events/${eventId}/eligibility`,
      { params: { userId } }
    );
    return response.data;
  },
};
