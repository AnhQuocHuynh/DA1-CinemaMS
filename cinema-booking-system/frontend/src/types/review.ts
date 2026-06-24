export interface ReviewResponse {
  id: number;
  userId: number;
  movieId: number | null;
  eventId: number | null;
  rating: number;
  comment: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  createdAt: string;
}

export interface CreateReviewRequest {
  userId: number;
  movieId?: number;
  eventId?: number;
  rating: number;
  comment?: string;
}

export interface ReviewInsightResponse {
  movieId: number | null;
  eventId: number | null;
  totalReviews: number;
  averageRating: number;
  oneStarCount: number;
  twoStarCount: number;
  threeStarCount: number;
  fourStarCount: number;
  fiveStarCount: number;
}

export interface ReviewEligibilityResponse {
  userId: number;
  movieId: number | null;
  eventId: number | null;
  eligible: boolean;
  hasReviewed: boolean;
  hasPaidTicket: boolean;
  watched: boolean;
  reasonCode: string;
  message: string;
}
