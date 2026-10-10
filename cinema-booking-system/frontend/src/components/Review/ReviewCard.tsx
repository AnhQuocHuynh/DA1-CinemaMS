import React from 'react';
import { User } from 'lucide-react';
import { StarRating } from './StarRating';
import type { ReviewResponse } from '../../types/review';
import { useTranslation } from 'react-i18next';

interface ReviewCardProps {
  review: ReviewResponse;
}

function timeAgo(dateString: string, t: any): string {
  const now = Date.now();
  const past = new Date(dateString).getTime();
  const diffMs = now - past;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return t('reviewCard.justNow', 'Just now');
  if (diffMinutes < 60) return t('reviewCard.minutesAgo', '{{count}} minutes ago', { count: diffMinutes });
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return t('reviewCard.hoursAgo', '{{count}} hours ago', { count: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return t('reviewCard.daysAgo', '{{count}} days ago', { count: diffDays });
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return t('reviewCard.monthsAgo', '{{count}} months ago', { count: diffMonths });
  return t('reviewCard.yearsAgo', '{{count}} years ago', { count: Math.floor(diffMonths / 12) });
}

export const ReviewCard: React.FC<ReviewCardProps> = ({ review }) => {
  const { t } = useTranslation();
  return (
    <div className="flex gap-4 py-5 border-b border-outline-variant/30 last:border-0">
      {/* Avatar */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
        <User size={18} className="text-blue-500" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-sm font-semibold text-on-surface">
            {t('reviewCard.userPrefix', 'User #')}{review.userId}
          </span>
          <span className="text-xs text-on-surface-variant">{timeAgo(review.createdAt, t)}</span>
        </div>

        <StarRating value={review.rating} size={14} />

        {review.comment && (
          <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">{review.comment}</p>
        )}
      </div>
    </div>
  );
};
