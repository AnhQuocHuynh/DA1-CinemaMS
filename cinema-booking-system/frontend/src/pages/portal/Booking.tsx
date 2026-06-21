import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Info, AlertCircle, Timer } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { SiteTopNav } from '../../components/SiteTopNav';
import { SeatLegend } from '../../components/portal/SeatLegend';
import { SeatMapGrid } from '../../components/portal/SeatMapGrid';
import { HoldTimer } from '../../components/portal/HoldTimer';
import { useSeatSelection } from '../../hooks/useSeatSelection';
import { useBookingStore } from '../../store/bookingStore';
import { movieService } from '../../services/movieService';
import { bookingService } from '../../services/bookingService';
import { formatVND, formatShowtime } from '../../utils/formatters';

/** Duration for the pre-hold selection timer (seconds) */
const PRE_HOLD_DURATION = 10 * 60; // 10 minutes


export const Booking: React.FC = () => {
  const { showtimeId = '' } = useParams<{ showtimeId: string }>();
  const navigate = useNavigate();

  const {
    seatMap,
    selectedSeats,
    isSelected,
    toggleSeat,
    summary,
    isLoading,
    error,
    holdSelectedSeats,
    isHolding,
    holdError,
  } = useSeatSelection(showtimeId);

  const {
    showtimeData,
    movieTitle,
    holdExpiresAt,
    setMovieTitle,
    setMoviePosterUrl,
  } = useBookingStore();

  // ── Pre-selection countdown (starts only when a seat is selected) ─────────
  const [preSeconds, setPreSeconds] = useState(PRE_HOLD_DURATION);
  const preTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hadSeatsRef = useRef(false);

  useEffect(() => {
    // Stop timer once seats are actually held
    if (holdExpiresAt) {
      if (preTimerRef.current) { clearInterval(preTimerRef.current); preTimerRef.current = null; }
      return;
    }

    // No seats selected → pause & reset
    if (selectedSeats.length === 0) {
      if (preTimerRef.current) { clearInterval(preTimerRef.current); preTimerRef.current = null; }
      // Only reset if user previously had seats (went back to 0)
      if (hadSeatsRef.current) {
        setPreSeconds(PRE_HOLD_DURATION);
        hadSeatsRef.current = false;
      }
      return;
    }

    // Seats selected → start ticking (if not already running)
    hadSeatsRef.current = true;
    if (!preTimerRef.current) {
      preTimerRef.current = setInterval(() => {
        setPreSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(preTimerRef.current!);
            preTimerRef.current = null;
            window.location.reload();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (preTimerRef.current) { clearInterval(preTimerRef.current); preTimerRef.current = null; }
    };
  }, [holdExpiresAt, selectedSeats.length]);

  const preMM = String(Math.floor(preSeconds / 60)).padStart(2, '0');
  const preSS = String(preSeconds % 60).padStart(2, '0');
  const preProgress = (preSeconds / PRE_HOLD_DURATION) * 100;
  const preIsUrgent = preSeconds > 0 && preSeconds <= 60;

  // Fetch movie title when showtimeData arrives
  useEffect(() => {
    if (!showtimeData?.movieId || movieTitle) return;
    movieService.getMovieById(showtimeData.movieId).then((m) => {
      setMovieTitle(m.title);
      setMoviePosterUrl(m.posterUrl);
    }).catch(console.error);
  }, [showtimeData, movieTitle, setMovieTitle, setMoviePosterUrl]);

  const handleProceed = useCallback(async () => {
    if (selectedSeats.length === 0) return;

    // If seats are already held (e.g. coming back from checkout), skip re-holding
    if (holdExpiresAt && holdExpiresAt.getTime() > Date.now()) {
      isNavigatingAwayRef.current = true;
      navigate('/user/checkout');
      return;
    }

    const success = await holdSelectedSeats();
    if (success) {
      isNavigatingAwayRef.current = true;
      navigate('/user/checkout');
    }
  }, [selectedSeats.length, holdSelectedSeats, holdExpiresAt, navigate]);

  const handleTimerExpired = useCallback(() => {
    window.location.reload();
  }, []);

  // ── Leave / go-back confirmation ────────────────────────────────────────
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  // Store the intended navigation target when intercepting a nav-link click
  const pendingNavRef = useRef<string | null>(null);
  // Flag so the popstate cleanup never fights an intentional forward navigation
  const isNavigatingAwayRef = useRef(false);
  // Counts how many guard history entries have been pushed this mount
  const guardCountRef = useRef(0);
  const { clearSelection } = useBookingStore();

  // ── Back-button guard (popstate + dummy history entry) ───────────────
  // When seats are held, push a "guard" history entry so the first Back press
  // hits it instead of actually leaving. Then we open the modal.
  useEffect(() => {
    if (!holdExpiresAt) return;

    // Push a guard entry on top of the current URL
    window.history.pushState({ guardEntry: true }, '');
    guardCountRef.current += 1;

    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.guardEntry) return; // already processed
      // User pressed back and consumed our guard entry—intercept!
      // Re-push the guard so repeated presses are also caught
      window.history.pushState({ guardEntry: true }, '');
      pendingNavRef.current = null;
      setShowLeaveConfirm(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Only remove the guard entry if we are NOT intentionally navigating
      // away; otherwise history.go(-1) would undo the forward navigation.
      if (!isNavigatingAwayRef.current) {
        window.history.go(-1);
        guardCountRef.current = Math.max(0, guardCountRef.current - 1);
      }
    };
  }, [holdExpiresAt]);

  // ── In-app nav-link click interceptor ────────────────────────────
  useEffect(() => {
    if (!holdExpiresAt) return;

    const handleClick = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest('a');
      if (!anchor || !anchor.href) return;

      // Only intercept same-origin links that would navigate away from booking
      const targetUrl = new URL(anchor.href, window.location.origin);
      if (targetUrl.origin !== window.location.origin) return;
      if (targetUrl.pathname === window.location.pathname) return;

      event.preventDefault();
      pendingNavRef.current = targetUrl.pathname + targetUrl.search;
      setShowLeaveConfirm(true);
    };

    document.addEventListener('click', handleClick, true); // capture phase
    return () => document.removeEventListener('click', handleClick, true);
  }, [holdExpiresAt]);

  // ── Tab-close / hard-refresh guard (sendBeacon) ───────────────────
  useEffect(() => {
    if (!holdExpiresAt || selectedSeats.length === 0) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      const seatIds = selectedSeats.map((s) => s.numericId);
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
      const url = `${apiBase}/v1/showtimes/${showtimeId}/hold`;
      const token = localStorage.getItem('authToken');
      const payload = new Blob(
        [JSON.stringify({ seatIds, _token: token })],
        { type: 'application/json' }
      );
      navigator.sendBeacon(url, payload);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [holdExpiresAt, selectedSeats, showtimeId]);

  const handleLeaveConfirm = useCallback(async () => {
    setIsReleasing(true);
    try {
      // Release held seats on the backend so others can book them
      if (holdExpiresAt && selectedSeats.length > 0) {
        const seatIds = selectedSeats.map((s) => s.numericId);
        await bookingService.releaseHeldSeats(showtimeId, seatIds);
      }
    } catch (err) {
      console.warn('Failed to release held seats:', err);
    } finally {
      clearSelection();
      setIsReleasing(false);
      setShowLeaveConfirm(false);
      // Navigate to the intercepted link target, or fall back to going back
      const target = pendingNavRef.current;
      pendingNavRef.current = null;
      isNavigatingAwayRef.current = true;
      if (target) {
        navigate(target);
      } else {
        // Go back past every guard entry (guardCountRef) AND the original
        // booking page history entry (+1) to land on the actual previous page.
        navigate(-(1 + guardCountRef.current));
      }
    }
  }, [holdExpiresAt, selectedSeats, showtimeId, clearSelection, navigate]);

  const handleLeaveCancel = useCallback(() => {
    pendingNavRef.current = null;
    setShowLeaveConfirm(false);
  }, []);

  const showtimeLabel = showtimeData
    ? formatShowtime(showtimeData.startTime)
    : 'Đang tải...';

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <SiteTopNav activeLabel="Showtimes" showSearch={false} />
      <main className="pt-24 pb-20 px-6 max-w-7xl mx-auto flex flex-col lg:flex-row gap-12">
        {/* Seat map area */}
        <div className="flex-grow">
          <div className="mb-12">
            <h1 className="text-2xl font-medium tracking-tight text-on-surface mb-1">
              Chọn Ghế
            </h1>
            <p className="text-on-surface-variant text-sm">
              {movieTitle ?? '...'} • {showtimeLabel}
            </p>
          </div>

          {/* Screen indicator */}
          <div className="flex flex-col items-center mb-16">
            <div className="w-full max-w-2xl bg-surface-container-highest/20 h-12 rounded-t-[100%] flex items-center justify-center relative">
              <div className="absolute bottom-0 w-4/5 h-1 bg-gradient-to-r from-transparent via-primary to-transparent blur-[1px]" />
            </div>
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-outline mt-4">
              MÀN HÌNH
            </span>
          </div>

          {/* Error state */}
          {error && (
            <div className="flex items-center gap-3 bg-error/10 text-error border border-error/30 rounded-lg p-4 mb-8">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {isLoading || !seatMap ? (
            <div className="text-center py-10 text-on-surface-variant animate-pulse">
              Đang tải sơ đồ ghế...
            </div>
          ) : (
            <div className="perspective-container">
              <div className="perspective-map">
                <SeatMapGrid seatMap={seatMap} isSelected={isSelected} onSeatToggle={toggleSeat} />
              </div>
            </div>
          )}

          <SeatLegend />
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-80 shrink-0">
          <div className="sticky top-28 space-y-6">
            {/* Hold countdown — shows after hold is confirmed */}
            <HoldTimer expiresAt={holdExpiresAt} onExpired={handleTimerExpired} />

            {/* Pre-selection countdown — appears only once a seat is selected */}
            {!holdExpiresAt && selectedSeats.length > 0 && (
              <div className={`p-6 rounded-xl shadow-lg ${preIsUrgent ? 'bg-red-600' : 'bg-inverse-surface'} text-white`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 opacity-70" />
                    <span className="text-[10px] font-bold tracking-widest uppercase opacity-70">
                      Thời gian chọn ghế
                    </span>
                  </div>
                  <span className="text-sm font-mono">{preMM}:{preSS}</span>
                </div>
                <div className="text-3xl font-black tracking-tighter tabular-nums">{preMM}:{preSS}</div>
                <p className="text-xs opacity-60 mt-2">
                  Vui lòng chọn ghế và xác nhận trong thời gian này.
                </p>
                <div className="mt-4 h-1 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${preIsUrgent ? 'bg-yellow-300' : 'bg-primary-container'}`}
                    style={{ width: `${preProgress}%` }}
                  />
                </div>
                {preSeconds === 0 && (
                  <p className="text-xs mt-3 text-white/80">Hết thời gian. Đang tải lại...</p>
                )}
              </div>
            )}

            {/* Selected seats summary */}
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 space-y-6">
              <div>
                <h3 className="text-[10px] font-bold tracking-widest uppercase text-outline mb-4">
                  Ghế đã chọn
                </h3>
                <div className="space-y-3">
                  {selectedSeats.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">Chưa có ghế nào được chọn.</p>
                  ) : (
                    selectedSeats.map((seat) => (
                      <div key={seat.id} className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-surface-container-high rounded flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">{seat.label}</span>
                          </div>
                          <span className="text-sm font-medium capitalize">
                            {seat.type === 'vip' ? 'VIP' : seat.type === 'couple' ? 'Couple' : 'Thường'}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-on-surface">
                          {formatVND(seat.price)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-outline-variant/20">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold uppercase tracking-tight">Tổng cộng</span>
                  <span className="text-2xl font-black tracking-tighter text-primary">
                    {formatVND(summary.total)}
                  </span>
                </div>
              </div>

              {holdError && (
                <div className="flex items-start gap-2 bg-error/10 text-error border border-error/30 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-xs font-medium">{holdError}</p>
                </div>
              )}

              <button
                className="w-full py-4 bg-primary text-white font-bold tracking-tight rounded-lg hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleProceed}
                disabled={selectedSeats.length === 0 || isHolding}
              >
                {isHolding ? 'Đang giữ ghế...' : 'Tiến hành thanh toán'}
                {!isHolding && <ArrowRight className="w-4 h-4" />}
              </button>

              <button
                className="w-full py-3 bg-transparent text-on-surface-variant font-semibold tracking-tight rounded-lg border border-outline-variant/30 hover:bg-surface-container-high active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                onClick={() => setShowLeaveConfirm(true)}
                type="button"
              >
                <ArrowLeft className="w-4 h-4" />
                Quay lại
              </button>

              <p className="text-[10px] text-center text-outline leading-relaxed px-4">
                Bằng cách tiếp tục, bạn đồng ý với điều khoản và chính sách đặt vé của chúng tôi.
              </p>
            </div>

            {/* Help */}
            <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-lg">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white">
                <Info className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface">
                  Cần hỗ trợ?
                </p>
                <p className="text-xs text-on-surface-variant">Gọi (555) 012-3456</p>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* ── Leave confirmation modal ────────────────────────────────────── */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in">
            <h3 className="text-lg font-bold text-slate-900">Hủy đặt vé?</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {holdExpiresAt
                ? 'Ghế bạn đang giữ sẽ được giải phóng để người khác có thể chọn. Bạn có chắc chắn muốn rời đi?'
                : 'Bạn sẽ mất lựa chọn ghế hiện tại. Bạn có chắc chắn muốn rời đi?'}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleLeaveCancel}
                disabled={isReleasing}
                className="flex-1 py-3 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Ở lại
              </button>
              <button
                onClick={handleLeaveConfirm}
                disabled={isReleasing}
                className="flex-1 py-3 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {isReleasing ? 'Đang hủy...' : 'Rời đi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
