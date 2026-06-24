import React from 'react';
import { User } from 'lucide-react';
import { StarRating } from './StarRating';
import type { ReviewResponse } from '../../types/review';

interface ReviewCardProps {
  review: ReviewResponse;
}

function timeAgo(dateString: string): string {
  const now = Date.now();
  const past = new Date(dateString).getTime();
  const diffMs = now - past;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} ngày trước`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} tháng trước`;
  return `${Math.floor(diffMonths / 12)} năm trước`;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({ review }) => {
  return (
    <div className="flex gap-4 py-5 border-b border-slate-100 last:border-0">
      {/* Avatar */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
        <User size={18} className="text-blue-500" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-sm font-semibold text-slate-800">
            Người dùng #{review.userId}
          </span>
          <span className="text-xs text-slate-400">{timeAgo(review.createdAt)}</span>
        </div>

        <StarRating value={review.rating} size={14} />

        {review.comment && (
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">{review.comment}</p>
        )}
      </div>
    </div>
  );
};
