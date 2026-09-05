import React, { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';

interface HoldTimerProps {
  expiresAt: Date | null;
  onExpired?: () => void;
}

/**
 * Countdown timer shown while seats are held.
 * Shows MM:SS and a progress bar. Calls onExpired when time runs out.
 */
export const HoldTimer: React.FC<HoldTimerProps> = ({ expiresAt, onExpired }) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (!expiresAt) return;

    const tick = () => {
      const diff = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) onExpired?.();
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpired]);

  const totalSeconds = 10 * 60; // 600
  const progress = expiresAt ? (secondsLeft / totalSeconds) * 100 : 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const isUrgent = secondsLeft > 0 && secondsLeft <= 60;

  if (!expiresAt) return null;

  return (
    <div className={`rounded-xl p-5 ${isUrgent ? 'bg-error/90' : 'bg-inverse-surface'} text-white`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 opacity-70" />
          <span className="text-[10px] font-bold tracking-widest uppercase opacity-70">
            Giữ ghế hết hạn sau
          </span>
        </div>
        <span className="text-sm font-mono">{mm}:{ss}</span>
      </div>
      <div className="text-3xl font-black tracking-tighter tabular-nums mb-3">
        {mm}:{ss}
      </div>
      <div className="h-1 w-full bg-surface-container-lowest/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${isUrgent ? 'bg-yellow-300' : 'bg-primary-container'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      {secondsLeft === 0 && (
        <p className="text-xs mt-3 text-white/80">Ghế đã được giải phóng. Vui lòng chọn lại.</p>
      )}
    </div>
  );
};
