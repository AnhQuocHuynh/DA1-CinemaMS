import apiClient from '../lib/apiClient';

export interface MovieRecommendation {
  movieId: number;
  title: string;
  posterUrl: string;
  score: number;   // confidence 0.0-1.0
  tier: 'COLLABORATIVE' | 'CONTENT_BASED' | 'POPULAR';
}

export const recommendationService = {
  /** Personalized recs — requires auth; falls through Tier 1 -> 2 -> 3 */
  getPersonalized: (limit = 10) =>
    apiClient
      .get<{ success: boolean; data: MovieRecommendation[] }>('/recommendations/movies', { params: { limit } })
      .then(r => r.data?.data),

  /** Globally popular movies — no auth required */
  getPopular: (limit = 10) =>
    apiClient
      .get<{ success: boolean; data: MovieRecommendation[] }>('/recommendations/movies/popular', { params: { limit } })
      .then(r => r.data?.data),

  /** Content-similar movies — no auth required */
  getSimilar: (movieId: number, limit = 6) =>
    apiClient
      .get<{ success: boolean; data: MovieRecommendation[] }>(`/recommendations/movies/${movieId}/similar`,
        { params: { limit } })
      .then(r => r.data?.data),
};
