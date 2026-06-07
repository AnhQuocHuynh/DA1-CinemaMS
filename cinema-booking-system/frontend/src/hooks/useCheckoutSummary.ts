import { useCallback, useMemo, useState } from 'react';
import { useBookingStore } from '../store/bookingStore';
import { bookingService } from '../services/bookingService';
import { BackendVoucher } from '../types/booking';
import { parseVND } from '../utils/formatters';

export const useCheckoutSummary = () => {
  const {
    selectedSeats,
    showtimeData,
    movieTitle,
    voucher,
    setVoucher,
  } = useBookingStore();

  const [voucherCode, setVoucherCode] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);

  const subtotal = useMemo(
    () => selectedSeats.reduce((sum, s) => sum + s.price, 0),
    [selectedSeats]
  );

  const discount = useMemo(() => {
    if (!voucher) return 0;
    if (voucher.discountType === 'PERCENTAGE') {
      const pct = parseVND(voucher.discountValue) / 100;
      const raw = Math.round(subtotal * pct);
      const maxDiscount = voucher.maxDiscountAmount
        ? parseVND(voucher.maxDiscountAmount)
        : Infinity;
      return Math.min(raw, maxDiscount);
    }
    return Math.min(parseVND(voucher.discountValue), subtotal);
  }, [voucher, subtotal]);

  const total = subtotal - discount;

  const applyVoucher = useCallback(async () => {
    if (!voucherCode.trim()) return;
    setVoucherLoading(true);
    setVoucherError(null);
    try {
      const v: BackendVoucher = await bookingService.validateVoucher(voucherCode.trim());
      setVoucher(v);
    } catch {
      setVoucherError('Mã giảm giá không hợp lệ hoặc đã hết hạn.');
      setVoucher(null);
    } finally {
      setVoucherLoading(false);
    }
  }, [voucherCode, setVoucher]);

  const removeVoucher = useCallback(() => {
    setVoucher(null);
    setVoucherCode('');
    setVoucherError(null);
  }, [setVoucher]);

  const summary = useMemo(() => ({
    movieTitle: movieTitle ?? '',
    cinemaName: '',
    hallName: '',
    showtime: showtimeData?.startTime ?? '',
    seats: selectedSeats,
    subtotal,
    discount,
    total,
    voucherCode: voucher?.code ?? null,
  }), [movieTitle, showtimeData, selectedSeats, subtotal, discount, total, voucher]);

  return {
    summary,
    isLoading: false,
    voucherCode,
    setVoucherCode,
    voucherLoading,
    voucherError,
    appliedVoucher: voucher,
    applyVoucher,
    removeVoucher,
  };
};
