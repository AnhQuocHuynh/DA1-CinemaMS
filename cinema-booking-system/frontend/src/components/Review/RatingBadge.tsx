import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { reviewService } from '../../services/reviewService';
import type { ReviewInsightResponse } from '../../types/review';

interface RatingBadgeProps {
  type: 'movie' | 'event';
  id: number;
}

export const RatingBadge: React.FC<RatingBadgeProps> = ({ type, id }) => {
  const [insight, setInsight] = useState<ReviewInsightResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const fetch = type === 'movie'
      ? reviewService.getMovieInsight(id)
      : reviewService.getEventInsight(id);

    fetch
      .then((data) => {
        if (!cancelled) setInsight(data);
      })
      .catch(() => {
        // silently fail — badge just won't display
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [type, id]);

  if (isLoading) {
    return <span className="inline-block w-12 h-4 bg-slate-100 rounded animate-pulse" />;
  }

  if (!insight || insight.totalReviews === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-400">
        <Star size={13} className="text-slate-300 fill-slate-300" />
        0.0
        <span className="text-xs font-normal text-slate-300">(0)</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
      <Star size={13} className="text-amber-400 fill-amber-400" />
      {insight.averageRating.toFixed(1)}
      <span className="text-xs font-normal text-slate-400">({insight.totalReviews})</span>
    </span>
  );
};
