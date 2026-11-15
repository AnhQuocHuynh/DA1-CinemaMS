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

  getTopK: (k = 5) =>
    apiClient
      .get<{ success: boolean; data: TopKRecommendation[] }>('/recommendations/top-k', { params: { k } })
      .then(r => r.data?.data || []),

  predict: (targetMovieId: number) =>
    apiClient
      .get<{ success: boolean; data: RatingPrediction }>('/recommendations/predict', { params: { targetMovieId } })
      .then(r => r.data.data),

  getMyRatings: () =>
    apiClient
      .get<{ success: boolean; data: UserRating[] }>('/recommendations/user-ratings/me')
      .then(r => r.data?.data || []),

  getMyRatingsPage: (page = 0, size = 20) =>
    apiClient
      .get<{ success: boolean; data: UserRatingPage }>('/recommendations/user-ratings/me/list', { params: { page, size } })
      .then(r => r.data.data),

  upsertMovieRating: (movieId: number, ratingValue: number) =>
    apiClient
      .post<{ success: boolean; data: UserRating }>('/recommendations/user-ratings', { movieId, ratingValue })
      .then(r => r.data.data),

  deleteMyRating: (movieId: number) =>
    apiClient.delete(`/recommendations/user-ratings/${movieId}`),

  recalculateMaxDissimilarity: () =>
    apiClient.post('/recommendations/max-dissimilarity/recalculate'),
};

export interface TopKRecommendation {
  movieId: number;
  title: string;
  posterUrl: string;
  predictedRating: number;
  uncertaintyScore: number;
  nearestMovieId: number | null;
  nearestMovieTitle: string | null;
  nearestMoviePosterUrl: string | null;
}

export interface RatingPrediction {
  userId: number;
  targetMovieId: number;
  nearestMovieId: number | null;
  rawPrediction: number;
  finalPrediction: number;
  userMeanRating: number;
  minDissimilarity: number;
  uncertaintyScore: number;
  thresholdApplied: boolean;
}

export interface UserRating {
  ratingId: number;
  movieId: number;
  movieTitle: string;
  posterUrl: string;
  ratingValue: number;
  createdAt: string;
}

export interface UserRatingPage {
  items: UserRating[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
