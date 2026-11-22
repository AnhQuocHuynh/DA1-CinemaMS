import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Clock, CreditCard, HelpCircle, Home, Pause, Play, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBookingStore } from '../../store/bookingStore';

export const BookingFailed: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearSelection, showtimeData, movieTitle } = useBookingStore();

  const reasonParam = searchParams.get('reason') || 'generic';
  const orderIdParam = searchParams.get('orderId');

  // Auto redirect countdown
  const [countdown, setCountdown] = useState<number>(12);
  const [isAutoRedirectPaused, setIsAutoRedirectPaused] = useState<boolean>(false);

  // Restore cached movie info if available
  const [cachedMovie, setCachedMovie] = useState<string>('');

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('pending_booking');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.movieTitle) setCachedMovie(parsed.movieTitle);
      }
    } catch {
      // Ignore sessionStorage parsing errors
    }
  }, []);

  const displayMovie = movieTitle || showtimeData?.displayTitle || showtimeData?.eventName || cachedMovie;

  useEffect(() => {
    if (isAutoRedirectPaused) return;

    if (countdown <= 0) {
      handleGoHome();
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, isAutoRedirectPaused]);

  const handleGoHome = () => {
    try {
      sessionStorage.removeItem('pending_booking');
    } catch {
      // Ignore
    }
    clearSelection();
    navigate('/');
  };

  const getReasonInfo = () => {
    switch (reasonParam.toLowerCase()) {
      case 'timeout':
      case 'expired':
        return {
          icon: <Clock className="w-5 h-5 text-amber-500 shrink-0" />,
          title: t('bookingFailed.reasonTimeoutTitle', 'Hold Window Expired'),
          description: t(
            'bookingFailed.reasonTimeout',
            'The temporary seat hold expired before payment could be completed. To ensure fairness for all guests, held seats are released back to the auditorium when checkout is not finished in time.'
          ),
        };
      case 'declined':
      case 'payment_declined':
      case 'payment_failed':
        return {
          icon: <CreditCard className="w-5 h-5 text-red-500 shrink-0" />,
          title: t('bookingFailed.reasonDeclinedTitle', 'Payment Declined'),
          description: t(
            'bookingFailed.reasonDeclined',
            'Your card issuer or payment provider declined the transaction. Please check your card balance, limits, or contact your bank.'
          ),
        };
      case 'cancelled':
        return {
          icon: <XCircle className="w-5 h-5 text-zinc-400 shrink-0" />,
          title: t('bookingFailed.reasonCancelledTitle', 'Checkout Cancelled'),
          description: t(
            'bookingFailed.reasonCancelled',
            'The checkout process was cancelled or closed before authorization was completed. No payment was charged.'
          ),
        };
      default:
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
          title: t('bookingFailed.reasonGenericTitle', 'Reservation Incomplete'),
          description: t(
            'bookingFailed.reasonGeneric',
            'We were unable to secure your chosen seats. This typically happens if the booking window timed out or network connectivity was temporarily interrupted.'
          ),
        };
    }
  };

  const reasonInfo = getReasonInfo();

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center px-6 py-12 md:py-20 text-on-surface">
      <div className="max-w-xl w-full bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-2xl p-8 md:p-10 text-center relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Hero Failure Badge */}
        <div className="relative mx-auto mb-6 w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 animate-pulse">
          <XCircle className="w-10 h-10" />
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-on-surface mb-2">
          {t('bookingFailed.title', 'Booking Unsuccessful')}
        </h1>
        <p className="text-sm md:text-base text-on-surface-variant font-medium mb-6">
          {t('bookingFailed.subtitle', 'We were unable to complete your reservation')}
        </p>

        {/* Key Customer Reassurance Box */}
        <div className="bg-surface-container-low border border-outline-variant/40 rounded-xl p-4 md:p-5 text-left mb-6 space-y-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="text-xs md:text-sm text-on-surface leading-relaxed">
              <p className="font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5">
                {t('bookingFailed.refundGuarantee', 'No Permanent Charges Applied')}
              </p>
              <p className="text-on-surface-variant">
                {t(
                  'bookingFailed.generalExplanation',
                  'If any funds were deducted from your bank or card, an automatic refund has been initiated and will return to your original payment method according to your bank’s processing schedule.'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Specific Reason Card */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 text-left mb-6">
          <div className="flex items-start gap-3">
            {reasonInfo.icon}
            <div>
              <h2 className="text-sm font-semibold text-on-surface">{reasonInfo.title}</h2>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                {reasonInfo.description}
              </p>
            </div>
          </div>

          {(orderIdParam || displayMovie) && (
            <div className="mt-3 pt-3 border-t border-outline-variant/20 flex flex-wrap items-center justify-between text-xs text-on-surface-variant">
              {displayMovie && (
                <span>
                  <span className="font-medium text-on-surface">{t('checkoutSuccess.movie', 'Movie')}:</span> {displayMovie}
                </span>
              )}
              {orderIdParam && (
                <span>
                  <span className="font-medium text-on-surface">{t('checkoutSuccess.orderId', 'Order ID')}:</span> #{orderIdParam}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Auto Redirect Banner */}
        <div className="mb-6 flex items-center justify-between bg-surface-container-low/70 px-4 py-2.5 rounded-lg border border-outline-variant/20 text-xs">
          <span className="text-on-surface-variant">
            {isAutoRedirectPaused ? (
              t('bookingFailed.redirectPaused', 'Auto-redirect is paused')
            ) : (
              <span>
                {t('bookingFailed.autoRedirectPrefix', 'Returning to home page in')}{' '}
                <strong className="text-primary font-bold">{countdown}s</strong>
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setIsAutoRedirectPaused((prev) => !prev)}
            className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium transition-colors"
          >
            {isAutoRedirectPaused ? (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>{t('bookingFailed.resume', 'Resume')}</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>{t('bookingFailed.stay', 'Stay here')}</span>
              </>
            )}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={handleGoHome}
            className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            <Home className="w-4 h-4" />
            <span>{t('bookingFailed.goHome', 'Return to Home Page')}</span>
          </button>

          <Link
            to="/movies"
            onClick={() => clearSelection()}
            className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{t('bookingFailed.tryAgain', 'Explore Movies')}</span>
          </Link>
        </div>

        {/* Support Note */}
        <div className="mt-8 pt-4 border-t border-outline-variant/20 text-xs text-on-surface-variant/80 flex items-center justify-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>
            {t(
              'bookingFailed.needHelp',
              'Need assistance? Please contact our customer support with your booking reference.'
            )}
          </span>
        </div>
      </div>
    </main>
  );
};

export default BookingFailed;
