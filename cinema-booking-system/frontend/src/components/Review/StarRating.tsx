import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  interactive?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  size = 20,
  interactive = false,
}) => {
  const [hoverValue, setHoverValue] = useState(0);
  const displayValue = interactive && hoverValue > 0 ? hoverValue : value;

  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.floor(displayValue);
        const halfFilled = !filled && star === Math.ceil(displayValue) && displayValue % 1 >= 0.25;

        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            className={`relative transition-transform ${
              interactive
                ? 'cursor-pointer hover:scale-110 active:scale-95'
                : 'cursor-default'
            }`}
            onClick={() => interactive && onChange?.(star)}
            onMouseEnter={() => interactive && setHoverValue(star)}
            onMouseLeave={() => interactive && setHoverValue(0)}
          >
            {/* Background (empty) star */}
            <Star
              size={size}
              className="text-slate-200"
              strokeWidth={1.5}
            />
            {/* Filled overlay */}
            {(filled || halfFilled) && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: filled ? '100%' : '50%' }}
              >
                <Star
                  size={size}
                  className="text-amber-400 fill-amber-400"
                  strokeWidth={1.5}
                />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
