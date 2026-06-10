import React, { useState } from 'react';
import { Lock, Tag, X, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useCheckoutSummary } from '../../hooks/useCheckoutSummary';
import { HoldTimer } from '../../components/portal/HoldTimer';
import { useBookingStore } from '../../store/bookingStore';
import { useAuthStore } from '../../store/authStore';
import { bookingService } from '../../services/bookingService';
import { formatVND, formatShowtime } from '../../utils/formatters';

type PaymentMethod = 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'WALLET';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'CREDIT_CARD', label: 'Thẻ tín dụng' },
  { value: 'DEBIT_CARD', label: 'Thẻ ghi nợ' },
  { value: 'BANK_TRANSFER', label: 'Chuyển khoản ngân hàng' },
  { value: 'WALLET', label: 'Ví điện tử' },
];

export const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
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
    setPendingOrder,
    setCompletedOrder,
  } = useBookingStore();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CREDIT_CARD');
  const [isProcessing, setIsProcessing] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const handleTimerExpired = () => navigate(-1);

  const handlePay = async () => {
    if (!user || !showtimeData) {
      setPayError('Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.');
      return;
    }
    if (selectedSeats.length === 0) {
      setPayError('Không có ghế nào được chọn.');
      return;
    }

    setIsProcessing(true);
    setPayError(null);

    try {
      const seatIds = selectedSeats.map((s) => s.numericId);
      const userId = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10);

      // 1. Create order
      const order = await bookingService.createOrder({
        userId,
        showtimeId: showtimeData.id,
        seatIds,
        voucherCode: appliedVoucher?.code ?? null,
      });
      setPendingOrder(order);

      // 2. Process payment
      const transactionId = `TXN-${crypto.randomUUID()}`;
      const paidOrder = await bookingService.processPayment(order.id, paymentMethod, transactionId);
      setCompletedOrder(paidOrder);

      navigate('/user/checkout-success');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setPayError(
        axiosErr?.response?.data?.message || 'Thanh toán thất bại. Vui lòng thử lại.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const showtimeLabel = showtimeData ? formatShowtime(showtimeData.startTime) : '';

  return (
    <main className="min-h-screen flex flex-col items-center py-12 px-6 md:py-20 bg-surface">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Header */}
        <div className="lg:col-span-12 mb-4">
          <div className="flex items-center gap-4 mb-8">
            <Link
              to={-1 as never}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-container-low hover:bg-surface-container-high transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-on-surface">Xác nhận đơn hàng</h1>
              <p className="text-sm text-on-surface-variant font-medium uppercase tracking-widest">
                Bước 3 / 3: Thanh toán
              </p>
            </div>
          </div>
        </div>

        {/* Left: booking summary + voucher */}
        <div className="lg:col-span-7 space-y-8">
          {/* Hold timer */}
          <HoldTimer expiresAt={holdExpiresAt} onExpired={handleTimerExpired} />

          {/* Booking summary card */}
          <section className="bg-surface-container-lowest rounded-xl p-8 shadow-sm">
            <div className="flex justify-between items-start mb-8">
              <div className="space-y-1">
                <span className="text-[10px] font-bold tracking-widest uppercase text-outline">
                  Phim đã chọn
                </span>
                <h2 className="text-2xl font-bold text-on-surface tracking-tight">
                  {summary.movieTitle || '—'}
                </h2>
                {showtimeLabel && (
                  <p className="text-sm text-on-surface-variant mt-1">{showtimeLabel}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-y-8 border-t border-surface-container-low pt-8">
              {/* Seats */}
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-outline mb-3">
                  Ghế đã chọn
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
                  Chi tiết giá
                </p>
                <div className="space-y-3">
                  {summary.seats.map((s) => (
                    <div key={s.id} className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant">
                        Ghế {s.label} ({s.type === 'vip' ? 'VIP' : s.type === 'couple' ? 'Couple' : 'Thường'})
                      </span>
                      <span className="font-medium text-on-surface">{formatVND(s.price)}</span>
                    </div>
                  ))}
                  {summary.discount > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-green-600 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        Giảm giá ({appliedVoucher?.code})
                      </span>
                      <span className="font-medium text-green-600">- {formatVND(summary.discount)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Voucher section */}
          <section className="bg-surface-container-low rounded-lg p-6">
            <p className="text-[10px] font-bold tracking-widest uppercase text-outline block mb-3">
              Mã khuyến mãi
            </p>
            {appliedVoucher ? (
              <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-bold text-green-600">{appliedVoucher.code}</span>
                  <span className="text-xs text-on-surface-variant">
                    — giảm {formatVND(summary.discount)}
                  </span>
                </div>
                <button onClick={removeVoucher} className="text-error hover:opacity-80">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                <input
                  className="flex-1 w-full bg-surface-container-lowest border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary text-sm font-bold tracking-widest uppercase h-12 px-4 rounded outline-none transition"
                  placeholder="NHẬP MÃ"
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && applyVoucher()}
                />
                <button
                  className="w-full md:w-auto px-8 h-12 bg-inverse-surface text-white text-xs font-bold tracking-widest uppercase hover:bg-on-surface transition-all active:scale-95 rounded disabled:opacity-50"
                  onClick={applyVoucher}
                  disabled={voucherLoading || !voucherCode.trim()}
                >
                  {voucherLoading ? 'Đang kiểm tra...' : 'Áp dụng'}
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
            <section className="bg-surface-container-lowest rounded-xl p-8 shadow-sm border-t-4 border-primary">
              <h3 className="text-[11px] font-bold tracking-widest uppercase text-outline mb-6 text-center">
                Phương thức thanh toán
              </h3>

              <div className="space-y-3 mb-8">
                {PAYMENT_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`group relative flex items-center p-4 border rounded-lg cursor-pointer hover:bg-surface-container-low transition-all ${
                      paymentMethod === opt.value
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
                      className={`w-5 h-5 border-2 rounded-full flex items-center justify-center mr-4 transition-all ${
                        paymentMethod === opt.value
                          ? 'border-primary bg-primary'
                          : 'border-outline-variant bg-transparent'
                      }`}
                    >
                      {paymentMethod === opt.value && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    <span className="text-sm font-semibold text-on-surface">{opt.label}</span>
                  </label>
                ))}
              </div>

              <div className="border-t border-surface-container-low pt-6">
                {/* Total breakdown */}
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Tạm tính</span>
                    <span className="font-medium">{formatVND(summary.subtotal)}</span>
                  </div>
                  {summary.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">Giảm giá</span>
                      <span className="text-green-600 font-medium">- {formatVND(summary.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-end pt-2 border-t border-outline-variant/20 mt-2">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-outline">
                      Tổng thanh toán
                    </span>
                    <span className="text-3xl font-extrabold text-on-surface tracking-tighter leading-none">
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
                  className="w-full bg-primary text-white py-5 rounded shadow-lg shadow-primary/20 hover:bg-surface-tint active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handlePay}
                  disabled={isProcessing || selectedSeats.length === 0}
                >
                  <span className="text-sm font-bold tracking-widest uppercase">
                    {isProcessing ? 'Đang xử lý...' : 'Xác nhận & Thanh toán'}
                  </span>
                  {!isProcessing && <Lock className="w-4 h-4" />}
                </button>
                <p className="text-center text-[10px] text-outline mt-4 flex items-center justify-center gap-2">
                  GIAO DỊCH ĐƯỢC MÃ HÓA 256-BIT
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
};
