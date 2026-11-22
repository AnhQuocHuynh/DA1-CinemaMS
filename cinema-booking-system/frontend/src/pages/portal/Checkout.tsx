import React, { useState, useEffect } from 'react';
import { Lock, Tag, X, AlertCircle, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useCheckoutSummary } from '../../hooks/useCheckoutSummary';
import { HoldTimer } from '../../components/portal/HoldTimer';
import { useBookingStore } from '../../store/bookingStore';
import { useAuthStore } from '../../store/authStore';
import { bookingService } from '../../services/bookingService';
import { paymentService } from '../../services/paymentService';
import { formatVND, formatShowtime } from '../../utils/formatters';
import { PushNotificationPayload } from '../../types/notification';

type PaymentMethod = 'STRIPE' | 'PAYPAL';

const getPaymentOptions = (t: (key: string) => string): { value: PaymentMethod; label: string }[] => [
  { value: 'STRIPE', label: t('checkout.stripe') },
  { value: 'PAYPAL', label: t('checkout.paypal') },
];

export const Checkout: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const PAYMENT_OPTIONS = getPaymentOptions(t);
  const {
    summary,
    voucherCode,
    setVoucherCode,
    voucherLoading,
    voucherError,
    appliedVoucher,
    applyVoucher,
    removeVoucher,
  } = useCheckoutSummary();

  const {
    selectedSeats,
    showtimeData,
    holdExpiresAt,
    pendingOrder,
    setPendingOrder,
    setCompletedOrder,
    clearSelection,
  } = useBookingStore();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('STRIPE');
  const [isProcessing, setIsProcessing] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const handleTimerExpired = () => {
    clearSelection();
    navigate('/user/booking-failed?reason=timeout');
  };

  useEffect(() => {
    // 1. Direct access check: if no seats selected and no showtime
    if (selectedSeats.length === 0 || !showtimeData) {
      navigate('/', { replace: true });
      return;
    }

    // 2. Hold timer check: if the hold already expired (e.g. while away on gateway)
    if (holdExpiresAt && new Date(holdExpiresAt).getTime() <= Date.now()) {
      clearSelection();
      navigate('/user/booking-failed?reason=timeout', { replace: true });
      return;
    }

    // 3. Status check: if an order exists, verify it wasn't already paid or cancelled
    if (pendingOrder?.id) {
      bookingService.getOrderById(pendingOrder.id)
        .then((ord) => {
          if (ord.status === 'PAID') {
            setCompletedOrder(ord);
            navigate(`/user/checkout-success?orderId=${ord.id}`, { replace: true });
          } else if (ord.status === 'CANCELLED') {
            clearSelection();
            navigate(`/user/booking-failed?reason=cancelled&orderId=${ord.id}`, { replace: true });
          }
        })
        .catch((err) => {
          console.warn('Could not verify pending order status:', err);
        });
    }
  }, [selectedSeats.length, showtimeData, holdExpiresAt, pendingOrder?.id, navigate, clearSelection, setCompletedOrder]);

  useEffect(() => {
    const handlePushNotification = (e: Event) => {
      const payload = (e as CustomEvent<PushNotificationPayload>).detail;
      if (!payload) return;

      const orderId = payload.metadata?.orderId;
      if (pendingOrder?.id && orderId && Number(orderId) !== Number(pendingOrder.id)) {
        return;
      }

      const actionType = payload.metadata?.actionType;
      if (actionType === 'ORDER_CONFIRMED' || payload.type === 'BOOKING_CONFIRMATION') {
        setIsProcessing(false);
        navigate(`/user/checkout-success?orderId=${orderId || pendingOrder?.id}`, { replace: true });
      } else if (actionType === 'PAYMENT_FAILED' || payload.type === 'PAYMENT_FAILED') {
        setIsProcessing(false);
        setPayError(payload.body || (payload.metadata?.failureReason as string) || 'Payment failed. Please try another method.');
      } else if (actionType === 'ORDER_CANCELLED' || payload.type === 'BOOKING_CANCELLED') {
        setIsProcessing(false);
        clearSelection();
        navigate('/user/booking-failed?reason=timeout', { replace: true });
      }
    };

    window.addEventListener('cinema-push-notification', handlePushNotification);
    return () => {
      window.removeEventListener('cinema-push-notification', handlePushNotification);
    };
  }, [pendingOrder?.id, navigate, clearSelection]);

  const handlePay = async () => {
    if (!user || !showtimeData) {
      setPayError(t('checkout.sessionExpired'));
      return;
    }
    if (selectedSeats.length === 0) {
      setPayError(t('checkout.noSeats'));
      return;
    }

    setIsProcessing(true);
    setPayError(null);

    try {
      const seatIds = selectedSeats.map((s) => s.numericId);
      const userId = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10);

      // 1. Create order (or reuse existing pending order if 409 duplicate)
      let orderId: number;
      try {
        const order = await bookingService.createOrder({
          userId,
          showtimeId: showtimeData.id,
          seatIds,
          voucherCode: appliedVoucher?.code ?? null,
        });
        setPendingOrder(order);
        orderId = order.id;
      } catch (orderErr: any) {
        const errData = orderErr?.response?.data;
        if (
          orderErr?.response?.status === 409 &&
          (errData?.code === 'DUPLICATE_PENDING_ORDER' || errData?.errorCode === 'DUPLICATE_PENDING_ORDER') &&
          errData?.existingOrderId
        ) {
          const existingId = Number(errData.existingOrderId);
          // Verify that selected seats match the server's pending order seats before adopting existingOrderId
          let existingOrder = pendingOrder?.id === existingId ? pendingOrder : null;
          if (!existingOrder) {
            try {
              existingOrder = await bookingService.getOrderById(existingId);
            } catch (fetchErr) {
              console.warn('Failed to fetch existing pending order for seat verification:', fetchErr);
            }
          }

          if (existingOrder && existingOrder.seatIds) {
            const currentSeatIds = [...seatIds].sort((a, b) => a - b);
            const existingSeatIds = [...existingOrder.seatIds].sort((a, b) => a - b);
            const isMatch =
              currentSeatIds.length === existingSeatIds.length &&
              currentSeatIds.every((id, idx) => id === existingSeatIds[idx]);

            if (!isMatch) {
              setPendingOrder(null);
              throw new Error(
                'Existing pending order has different seat selection. Please go back to the seat map and try again.'
              );
            }
          }

          setPendingOrder(existingOrder || ({ id: existingId } as any));
          orderId = existingId;
        } else {
          throw orderErr;
        }
      }

      // Save context in sessionStorage before external redirect
      try {
        sessionStorage.setItem('pending_booking', JSON.stringify({
          orderId,
          showtimeData,
          movieTitle: showtimeData?.displayTitle || showtimeData?.eventName || '',
          selectedSeats,
          holdExpiresAt: holdExpiresAt ? holdExpiresAt.toISOString() : null,
          voucher: appliedVoucher ?? null,
        }));
      } catch (e) {
        console.warn('Failed to save pending booking in sessionStorage', e);
      }

      const successUrl = paymentMethod === 'STRIPE'
        ? `${window.location.origin}/user/checkout-success?orderId=${orderId}&session_id={CHECKOUT_SESSION_ID}`
        : `${window.location.origin}/user/checkout-success?orderId=${orderId}`;

      const paymentData = {
        orderId,
        paymentMethod: paymentMethod,
        successUrl,
        cancelUrl: `${window.location.origin}/user/booking-failed?reason=cancelled&orderId=${orderId}`
      };
      const paymentResponse = await paymentService.initiatePayment(paymentData);

      if (paymentResponse.paymentUrl) {
        window.location.href = paymentResponse.paymentUrl;
        return;
      }

      setCompletedOrder({ id: orderId } as any);
      navigate(`/user/checkout-success?orderId=${orderId}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setPayError(
        axiosErr?.response?.data?.message || t('checkout.paymentFailed')
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (selectedSeats.length === 0 || !showtimeData) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center px-6 py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const showtimeLabel = showtimeData ? formatShowtime(showtimeData.startTime) : '';

  return (
    <main className="min-h-screen flex flex-col items-center py-6 pb-32 px-4 sm:px-6 md:py-20 lg:pb-20 bg-surface">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12">
        {/* Header */}
        <div className="lg:col-span-12 mb-2 lg:mb-4">
          <div className="flex items-center gap-3 sm:gap-4 mb-2 lg:mb-8">
            <Link
              to={-1 as never}
              className="flex items-center justify-center w-11 h-11 rounded-full bg-surface-container-low hover:bg-surface-container-high transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-on-surface truncate">{t('checkout.title')}</h1>
              <p className="text-xs sm:text-sm text-on-surface-variant font-medium uppercase tracking-widest">
                {t('checkout.step3')}
              </p>
            </div>
          </div>
        </div>

        {/* Left: booking summary + voucher */}
        <div className="lg:col-span-7 space-y-5 lg:space-y-8">
          {/* Hold timer */}
          <HoldTimer expiresAt={holdExpiresAt} onExpired={handleTimerExpired} />

          {/* Booking summary card */}
          <section className="bg-surface-container-lowest rounded-xl p-5 sm:p-8 shadow-sm">
            <button
              type="button"
              onClick={() => setSummaryExpanded((prev) => !prev)}
              className="w-full text-left flex justify-between items-start gap-3 lg:cursor-default"
              aria-expanded={summaryExpanded}
            >
              <div className="space-y-1 min-w-0">
                <span className="text-[10px] font-bold tracking-widest uppercase text-outline">
                  {t('checkout.selectedMovie')}
                </span>
                <h2 className="text-lg sm:text-2xl font-bold text-on-surface tracking-tight">
                  {summary.movieTitle || '—'}
                </h2>
                {showtimeLabel && (
                  <p className="text-xs sm:text-sm text-on-surface-variant mt-1">{showtimeLabel}</p>
                )}
                <p className="lg:hidden text-xs font-semibold text-primary pt-1">
                  {summary.seats.length} {t('checkout.seat', 'ghế')} • {formatVND(summary.total)}
                </p>
              </div>
              <span className="lg:hidden w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                {summaryExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </button>

            <div className={`${summaryExpanded ? 'grid' : 'hidden lg:grid'} grid-cols-1 gap-y-6 sm:gap-y-8 border-t border-surface-container-low pt-6 sm:pt-8 mt-6`}>
              {/* Seats */}
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-outline mb-3">
                  {t('checkout.selectedSeats')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {summary.seats.map((s) => (
                    <span
                      key={s.id}
                      className="px-3 py-1 bg-primary/10 text-primary text-sm font-bold rounded"
                    >
                      {s.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Pricing breakdown */}
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-outline mb-4">
                  {t('checkout.priceDetails')}
                </p>
                <div className="space-y-3">
                  {summary.seats.map((s) => (
                    <div key={s.id} className="flex justify-between items-center gap-2 text-sm">
                      <span className="text-on-surface-variant min-w-0">
                        {t('checkout.seat')} {s.label} ({s.type === 'vip' ? t('booking.vip') : s.type === 'couple' ? t('booking.couple') : t('booking.regular')})
                      </span>
                      <span className="font-medium text-on-surface shrink-0">{formatVND(s.price)}</span>
                    </div>
                  ))}
                  {summary.discount > 0 && (
                    <div className="flex justify-between items-center gap-2 text-sm">
                      <span className="text-success flex items-center gap-1 min-w-0">
                        <Tag className="w-3 h-3 shrink-0" />
                        <span className="truncate">{t('checkout.discount')} ({appliedVoucher?.code})</span>
                      </span>
                      <span className="font-medium text-success shrink-0">- {formatVND(summary.discount)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Voucher section */}
          <section className="bg-surface-container-low rounded-lg p-4 sm:p-6">
            <p className="text-[10px] font-bold tracking-widest uppercase text-outline block mb-3">
              {t('checkout.promoCodeTitle')}
            </p>
            {appliedVoucher ? (
              <div className="flex items-center justify-between gap-2 bg-success/10 border border-success/30 rounded-lg px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <Tag className="w-4 h-4 text-success shrink-0" />
                  <span className="text-sm font-bold text-success">{appliedVoucher.code}</span>
                  <span className="text-xs text-on-surface-variant">
                    — giảm {formatVND(summary.discount)}
                  </span>
                </div>
                <button
                  onClick={removeVoucher}
                  className="text-error hover:opacity-80 p-2.5 -mr-2 min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
                  aria-label={t('common.remove', 'Remove')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                <input
                  className="flex-1 w-full bg-surface-container-lowest border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary text-base sm:text-sm font-bold tracking-widest uppercase h-12 px-4 rounded outline-none transition"
                  placeholder={t('checkout.enterCode')}
                  type="text"
                  autoCapitalize="characters"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && applyVoucher()}
                />
                <button
                  className="w-full md:w-auto px-8 h-12 bg-inverse-surface text-white text-xs font-bold tracking-widest uppercase hover:bg-on-surface transition-all active:scale-95 rounded disabled:opacity-50"
                  onClick={applyVoucher}
                  disabled={voucherLoading || !voucherCode.trim()}
                >
                  {voucherLoading ? t('checkout.checking') : t('checkout.apply')}
                </button>
              </div>
            )}
            {voucherError && (
              <p className="text-xs text-error mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {voucherError}
              </p>
            )}
          </section>
        </div>

        {/* Right: payment */}
        <div className="lg:col-span-5">
          <div className="sticky top-12 space-y-6">
            <section className="bg-surface-container-lowest rounded-xl p-5 sm:p-8 shadow-sm border-t-4 border-primary">
              <h3 className="text-[11px] font-bold tracking-widest uppercase text-outline mb-6 text-center">
                {t('checkout.paymentMethod')}
              </h3>

              <div className="space-y-3 mb-6 sm:mb-8">
                {PAYMENT_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`group relative flex items-center p-4 min-h-[56px] border rounded-lg cursor-pointer hover:bg-surface-container-low transition-all ${paymentMethod === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'border-outline-variant'
                      }`}
                  >
                    <input
                      className="sr-only"
                      name="payment"
                      type="radio"
                      value={opt.value}
                      checked={paymentMethod === opt.value}
                      onChange={() => setPaymentMethod(opt.value)}
                    />
                    <div
                      className={`w-5 h-5 border-2 rounded-full flex items-center justify-center mr-4 shrink-0 transition-all ${paymentMethod === opt.value
                          ? 'border-primary bg-primary'
                          : 'border-outline-variant bg-transparent'
                        }`}
                    >
                      {paymentMethod === opt.value && (
                        <div className="w-2 h-2 bg-surface-container-lowest rounded-full" />
                      )}
                    </div>
                    <span className="text-sm font-semibold text-on-surface">{opt.label}</span>
                  </label>
                ))}
              </div>

              <div className="border-t border-surface-container-low pt-6">
                {/* Total breakdown */}
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="text-on-surface-variant">{t('checkout.subtotal')}</span>
                    <span className="font-medium shrink-0">{formatVND(summary.subtotal)}</span>
                  </div>
                  {summary.discount > 0 && (
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="text-success">{t('checkout.discount')}</span>
                      <span className="text-success font-medium shrink-0">- {formatVND(summary.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-end gap-2 pt-2 border-t border-outline-variant/20 mt-2">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-outline">
                      {t('checkout.totalAmount')}
                    </span>
                    <span className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tighter leading-none shrink-0">
                      {formatVND(summary.total)}
                    </span>
                  </div>
                </div>

                {payError && (
                  <div className="flex items-start gap-2 bg-error/10 text-error border border-error/30 rounded-lg p-3 mb-4">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-xs font-medium">{payError}</p>
                  </div>
                )}

                <button
                  className="hidden lg:flex w-full bg-primary text-on-primary py-5 rounded shadow-lg shadow-primary/20 hover:bg-surface-tint active:scale-[0.98] transition-all items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handlePay}
                  disabled={isProcessing || selectedSeats.length === 0}
                >
                  <span className="text-sm font-bold tracking-widest uppercase">
                    {isProcessing ? t('checkout.processing') : t('checkout.confirmAndPay')}
                  </span>
                  {!isProcessing && <Lock className="w-4 h-4" />}
                </button>
                <p className="text-center text-[10px] text-outline mt-4 flex items-center justify-center gap-2">
                  {t('checkout.encrypted')}
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Pay Bar (< lg) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block">
              {t('checkout.totalAmount')}
            </span>
            <span className="text-xl font-black text-primary tracking-tight">
              {formatVND(summary.total)}
            </span>
          </div>
          <button
            className="min-h-[48px] px-6 bg-primary text-on-primary rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            onClick={handlePay}
            disabled={isProcessing || selectedSeats.length === 0}
          >
            <span className="text-sm font-bold tracking-wider uppercase">
              {isProcessing ? t('checkout.processing') : t('checkout.confirmAndPay')}
            </span>
            {!isProcessing && <Lock className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </main>
  );
};
