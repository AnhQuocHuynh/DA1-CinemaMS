import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Star } from 'lucide-react';
import { reviewService } from '../../services/reviewService';
import { useAuthStore } from '../../store/authStore';
import { StarRating } from './StarRating';
import { ReviewCard } from './ReviewCard';
import { ReviewForm } from './ReviewForm';
import type {
  ReviewResponse,
  ReviewInsightResponse,
  ReviewEligibilityResponse,
} from '../../types/review';

interface ReviewSectionProps {
  type: 'movie' | 'event';
  id: number;
}

export const ReviewSection: React.FC<ReviewSectionProps> = ({ type, id }) => {
  const user = useAuthStore((s) => s.user);

  const [insight, setInsight] = useState<ReviewInsightResponse | null>(null);
  const [reviews, setReviews] = useState<ReviewResponse[]>([]);
  const [eligibility, setEligibility] = useState<ReviewEligibilityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [insightData, reviewsData] = await Promise.all([
        type === 'movie'
          ? reviewService.getMovieInsight(id)
          : reviewService.getEventInsight(id),
        type === 'movie'
          ? reviewService.getMovieReviews(id)
          : reviewService.getEventReviews(id),
      ]);
      setInsight(insightData);
      setReviews(reviewsData);

      if (user?.id) {
        const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
        const eligibilityData =
          type === 'movie'
            ? await reviewService.checkMovieEligibility(id, userId)
            : await reviewService.checkEventEligibility(id, userId);
        setEligibility(eligibilityData);
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    } finally {
      setIsLoading(false);
    }
  }, [type, id, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmitReview = async (rating: number, comment: string) => {
    const userId = typeof user!.id === 'string' ? parseInt(user!.id, 10) : (user!.id as number);
    await reviewService.createReview({
      userId,
      rating,
      comment: comment || undefined,
      ...(type === 'movie' ? { movieId: id } : { eventId: id }),
    });
    // Refresh data after submit
    await fetchData();
  };

  if (isLoading) {
    return (
      <div className="mt-10 space-y-4 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-1/3" />
        <div className="h-24 bg-slate-100 rounded-xl" />
        <div className="h-16 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  const starCounts = insight
    ? [
        insight.fiveStarCount,
        insight.fourStarCount,
        insight.threeStarCount,
        insight.twoStarCount,
        insight.oneStarCount,
      ]
    : [0, 0, 0, 0, 0];
  const maxCount = Math.max(...starCounts, 1);

  return (
    <div className="mt-10">
      <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-6 flex items-center gap-2">
        <MessageSquare size={14} />
        Đánh giá & Nhận xét
      </h2>

      {/* Insight Summary */}
      {insight && insight.totalReviews > 0 && (
        <div className="flex flex-col sm:flex-row gap-8 items-start mb-8 p-6 rounded-xl bg-slate-50 border border-slate-200">
          {/* Average */}
          <div className="text-center sm:text-left flex-shrink-0">
            <div className="text-5xl font-black text-slate-900 tracking-tighter">
              {insight.averageRating.toFixed(1)}
            </div>
            <StarRating value={insight.averageRating} size={18} />
            <p className="text-xs text-slate-500 mt-1">
              {insight.totalReviews} đánh giá
            </p>
          </div>

          {/* Distribution */}
          <div className="flex-1 w-full space-y-1.5">
            {[5, 4, 3, 2, 1].map((star, idx) => (
              <div key={star} className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 w-3 text-right">{star}</span>
                <Star size={12} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${(starCounts[idx] / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 w-6 text-right">{starCounts[idx]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {insight && insight.totalReviews === 0 && (
        <div className="mb-8 p-6 rounded-xl bg-slate-50 border border-slate-200 text-center">
          <p className="text-slate-500 text-sm">Chưa có đánh giá nào. Hãy là người đầu tiên!</p>
        </div>
      )}

      {/* Review Form — show if user is eligible */}
      {eligibility?.eligible && (
        <div className="mb-8">
          <ReviewForm onSubmit={handleSubmitReview} />
        </div>
      )}

      {/* Eligibility messages */}
      {user && eligibility && !eligibility.eligible && (
        <div className="mb-8 p-4 rounded-lg bg-blue-50 border border-blue-100">
          <p className="text-sm text-blue-700">{eligibility.message || 'Bạn không đủ điều kiện đánh giá.'}</p>
        </div>
      )}

      {/* Review List */}
      {reviews.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  );
};
