import apiClient from '../lib/apiClient';

export interface MovieRecommendation {
  movieId: number;
  title: string;
  posterUrl: string;
  relevanceScore: number;
  reason: string;
  matchedGenres: string[];
  avgRating: number;
  bookingCount: number;
}

export interface RecommendationMetadata {
  returnedCount: number;
  processingTimeMs: number;
  fallbackUsed: boolean;
}

export interface RecommendationResponse {
  userId: number | null;
  algorithm: string;
  recommendations: MovieRecommendation[];
  metadata: RecommendationMetadata;
}

export const recommendationService = {
  /** Personalized recs — requires auth; falls through Tier 1 -> 2 -> 3 */
  getPersonalized: (limit = 10) =>
    apiClient
      .get<{ success: boolean; data: RecommendationResponse }>('/recommendations/movies', { params: { limit } })
      .then(r => r.data?.data?.recommendations || []),

  /** Globally popular movies — no auth required */
  getPopular: (limit = 10) =>
    apiClient
      .get<{ success: boolean; data: RecommendationResponse }>('/recommendations/movies/popular', { params: { limit } })
      .then(r => r.data?.data?.recommendations || []),

  /** Content-similar movies — no auth required */
  getSimilar: (movieId: number, limit = 6) =>
    apiClient
      .get<{ success: boolean; data: RecommendationResponse }>(`/recommendations/movies/${movieId}/similar`,
        { params: { limit } })
      .then(r => r.data?.data?.recommendations || []),
};
