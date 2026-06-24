import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { StarRating } from './StarRating';

interface ReviewFormProps {
  onSubmit: (rating: number, comment: string) => Promise<void>;
}

export const ReviewForm: React.FC<ReviewFormProps> = ({ onSubmit }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Vui lòng chọn số sao đánh giá.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(rating, comment);
      setSuccess(true);
      setRating(0);
      setComment('');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Đã xảy ra lỗi khi gửi đánh giá.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-6 text-center">
        <p className="text-green-700 font-semibold">🎉 Cảm ơn bạn đã đánh giá!</p>
        <p className="text-sm text-green-600 mt-1">Đánh giá của bạn đã được ghi nhận.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
      <h4 className="font-semibold text-slate-800">Viết đánh giá</h4>

      <div>
        <p className="text-sm text-slate-500 mb-2">Đánh giá của bạn</p>
        <StarRating value={rating} onChange={setRating} size={28} interactive />
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Chia sẻ cảm nhận của bạn (tuỳ chọn)..."
        rows={3}
        className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-shadow"
      />

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || rating === 0}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Send size={14} />
        {isSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}
      </button>
    </form>
  );
};
