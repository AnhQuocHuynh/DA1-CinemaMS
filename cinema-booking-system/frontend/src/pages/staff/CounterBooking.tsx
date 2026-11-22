import React, { useMemo, useState, useEffect } from 'react';
import { CheckCircle, FileText, Loader2, Ticket, UserRound } from 'lucide-react';
import { StaffLayout } from '../../components/staff/StaffLayout';
import { PrintableTicket } from '../../components/PrintableTicket';
import { downloadElementAsPDF } from '../../utils/pdfGenerator';
import { bookingService } from '../../services/bookingService';
import { staffService } from '../../services/staffService';
import { movieService, MovieResponse } from '../../services/movieService';
import { showtimeService } from '../../services/showtimeService';
import { ShowtimeResponse } from '../../types/showtime';
import { Seat, SeatMap, TicketDetails } from '../../types/booking';
import { StaffCounterBookingResult } from '../../types/staff';
import { formatVND } from '../../utils/formatters';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from 'react-i18next';

export const CounterBooking: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [movies, setMovies] = useState<MovieResponse[]>([]);
  const [showtimes, setShowtimes] = useState<ShowtimeResponse[]>([]);
  const [selectedMovieId, setSelectedMovieId] = useState<string>('');
  const [showtimeId, setShowtimeId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'BANK_TRANSFER'>('CASH');
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [result, setResult] = useState<StaffCounterBookingResult | null>(null);
  const [isLoadingSeats, setIsLoadingSeats] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberUser, setMemberUser] = useState<{ id: number; fullName: string; phone: string; tier?: string; loyaltyPoints?: number } | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupNotice, setLookupNotice] = useState<string | null>(null);

  useEffect(() => {
    const fetchMovies = async () => {
      try {
        const data = await movieService.getMovies();
        setMovies(data);
      } catch (err) {
        console.error('Failed to load movies', err);
      }
    };
    fetchMovies();
  }, []);

  useEffect(() => {
    const fetchShowtimes = async () => {
      if (!selectedMovieId) {
        setShowtimes([]);
        return;
      }
      try {
        const data = await showtimeService.getShowtimes(Number(selectedMovieId));
        // Filter out past showtimes
        const now = new Date();
        const validShowtimes = data.filter(st => new Date(st.startTime) >= now);
        // Sort by start time for better UX
        validShowtimes.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        setShowtimes(validShowtimes);
      } catch (err) {
        console.error('Failed to load showtimes', err);
      }
    };
    fetchShowtimes();
  }, [selectedMovieId]);

  const handleMovieChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMovieId(e.target.value);
    setShowtimeId('');
    setSeatMap(null);
    setSelectedSeats([]);
  };

  const subtotal = useMemo(
    () => selectedSeats.reduce((sum, seat) => sum + seat.price, 0),
    [selectedSeats]
  );

  const loadSeats = async () => {
    const numericShowtimeId = Number(showtimeId);
    if (!numericShowtimeId) {
      setError(t('staffCounterBooking.errorInvalidShowtime', 'Vui lòng chọn suất chiếu hợp lệ.'));
      return;
    }

    setIsLoadingSeats(true);
    setError(null);
    setResult(null);
    setSelectedSeats([]);
    try {
      const map = await bookingService.getSeatMap(numericShowtimeId);
      setSeatMap(map);
    } catch {
      setError(t('staffCounterBooking.errorLoadSeats', 'Không thể tải sơ đồ ghế cho suất chiếu này.'));
    } finally {
      setIsLoadingSeats(false);
    }
  };

  const toggleSeat = (seat: Seat) => {
    if (seat.status !== 'available' || seat.isPathway) {
      return;
    }
    setSelectedSeats((current) =>
      current.some((item) => item.numericId === seat.numericId)
        ? current.filter((item) => item.numericId !== seat.numericId)
        : [...current, seat]
    );
  };

  const handleLookupMember = async () => {
    if (!customerPhone.trim()) return;
    setIsLookingUp(true);
    setLookupNotice(null);
    try {
      const member = await staffService.lookupMemberByPhone(customerPhone.trim());
      if (member) {
        setMemberUser(member);
        if (!customerName) setCustomerName(member.fullName);
      } else {
        setMemberUser(null);
        setLookupNotice(t('staffCounterBooking.memberNotFound', 'Không tìm thấy thành viên. Đặt vé theo khách vãng lai.'));
      }
    } catch {
      setMemberUser(null);
      setLookupNotice(t('staffCounterBooking.memberNotFound', 'Không tìm thấy thành viên. Đặt vé theo khách vãng lai.'));
    } finally {
      setIsLookingUp(false);
    }
  };

  const submitBooking = async () => {
    const numericShowtimeId = Number(showtimeId);
    if (!numericShowtimeId || selectedSeats.length === 0) {
      setError(t('staffCounterBooking.errorNoSeats', 'Vui lòng chọn suất chiếu và ít nhất một ghế.'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const booking = await staffService.createCounterBooking({
        showtimeId: numericShowtimeId,
        seatIds: selectedSeats.map((seat) => seat.numericId),
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        userId: memberUser ? memberUser.id : 0,
        voucherCode: voucherCode || null,
        paymentMethod,
      });
      setResult(booking);
      setSeatMap(null);
      setSelectedSeats([]);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || t('staffCounterBooking.errorCreateBooking', 'Không thể tạo booking tại quầy.'));
      try {
        const refreshedMap = await bookingService.getSeatMap(numericShowtimeId);
        setSeatMap(refreshedMap);
        setSelectedSeats([]);
      } catch {
        // ignore seat map reload failure
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const printableTickets = useMemo<TicketDetails[]>(() => {
    if (!result) return [];
    const dt = result.startTime ? new Date(result.startTime) : null;
    const title = result.displayTitle || result.movieTitle || result.eventTitle || 'Showtime';
    const base = {
      orderId: result.id,
      movieTitle: title,
      cinemaName: result.cinemaName || '',
      hallName: result.roomName || '',
      showtime: result.startTime || '',
      date: dt ? dt.toLocaleDateString('vi-VN') : '',
      time: dt ? dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '',
      qrCodeData: '',
      status: result.status,
      posterUrl: '',
    };

    if (result.tickets && result.tickets.length > 0) {
      return result.tickets.map((tk) => ({
        ...base,
        ticketCode: tk.ticketCode,
        seats: tk.seatLabel ? [tk.seatLabel] : [],
        seatLabel: tk.seatLabel || '',
        qrCodeData: `CINEMA|${tk.ticketCode}|SEAT:${tk.seatLabel || ''}`,
        price: Number(tk.price || 0),
      }));
    }

    const labels = result.seatLabels && result.seatLabels.length > 0 ? result.seatLabels : ['COUNTER'];
    return labels.map((label, idx) => ({
      ...base,
      ticketCode: `BK-${result.id}-${idx + 1}`,
      seats: [label],
      seatLabel: label,
      qrCodeData: `CINEMA|BK-${result.id}|SEAT:${label}`,
      price: Number(result.finalAmount || 0) / labels.length,
    }));
  }, [result]);

  const handlePrintReceipt = async () => {
    if (!result || printableTickets.length === 0) return;
    setIsPrintingReceipt(true);
    try {
      await downloadElementAsPDF(`printable-counter-batch-${result.id}`, `counter-tickets-${result.id}.pdf`);
    } catch (err) {
      console.error('Failed to print receipt PDF:', err);
      addToast(t('staffCounterBooking.errorPrintReceipt', 'Unable to export ticket PDF.'), 'error');
    } finally {
      setIsPrintingReceipt(false);
    }
  };

  return (
    <StaffLayout activeItemId="counter-booking">
      <section className="mb-6 sm:mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="text-[0.65rem] uppercase tracking-[0.15em] font-bold text-on-surface-variant mb-1 block">
            {t('staffCounterBooking.counterSales', 'Counter Sales')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">{t('staffCounterBooking.title', 'Đặt vé tại quầy')}</h2>
          <p className="text-on-surface-variant mt-2 text-sm max-w-xl">
            {t('staffCounterBooking.subtitle', 'Chọn suất chiếu, ghế trống và xác nhận thanh toán trực tiếp để in/xuất mã vé ngay.')}
          </p>
        </div>
      </section>

      {error && (
        <div className="mb-6 rounded-lg border border-error-container bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
          {error}
        </div>
      )}

      <div className={`grid gap-5 lg:gap-6 lg:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr] lg:items-start ${selectedSeats.length > 0 ? 'pb-20 lg:pb-0' : ''}`}>
        {/* Card 1: Showtime Selection (top on mobile/tablet, top-left on desktop) */}
        <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 sm:p-6 shadow-sm lg:col-start-1 lg:row-start-1">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <UserRound className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-on-surface">{t('staffCounterBooking.bookingInfo', 'Thông tin booking')}</h3>
              <p className="text-xs text-on-surface-variant">{t('staffCounterBooking.walkInCustomer', 'Khách vãng lai không cần tài khoản')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('staffCounterBooking.selectMovie', 'Chọn Phim')}</span>
              <select
                value={selectedMovieId}
                onChange={handleMovieChange}
                className="mt-1 w-full min-w-0 min-h-[44px] rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-base sm:text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="" className="bg-surface-container text-on-surface">{t('staffCounterBooking.selectMoviePlaceholder', '-- Chọn phim --')}</option>
                {movies.map(m => (
                  <option key={m.id} value={m.id} className="bg-surface-container text-on-surface">{m.title}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('staffCounterBooking.selectShowtime', 'Chọn Suất Chiếu')}</span>
              <div className="mt-1 flex gap-2">
                <select
                  value={showtimeId}
                  onChange={(e) => {
                    setShowtimeId(e.target.value);
                    setSeatMap(null);
                    setSelectedSeats([]);
                  }}
                  disabled={!selectedMovieId || showtimes.length === 0}
                  className="flex-1 min-w-0 w-full min-h-[44px] rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-base sm:text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:bg-surface-container-low"
                >
                  <option value="" className="bg-surface-container text-on-surface">{t('staffCounterBooking.selectShowtimePlaceholder', '-- Chọn suất chiếu --')}</option>
                  {showtimes.map(st => {
                    const date = new Date(st.startTime);
                    const formattedDate = date.toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' });
                    const formattedTime = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <option key={st.id} value={st.id} className="bg-surface-container text-on-surface">
                        {formattedDate} {formattedTime} - {st.roomName || 'Room ' + st.roomId}
                      </option>
                    );
                  })}
                </select>
                <button
                  onClick={loadSeats}
                  disabled={isLoadingSeats || !showtimeId}
                  className="rounded-lg bg-primary hover:bg-primary/90 px-4 min-h-[44px] text-sm font-bold text-white disabled:opacity-60 shrink-0 shadow-sm transition-colors"
                >
                  {isLoadingSeats ? <Loader2 className="w-4 h-4 animate-spin" /> : t('staffCounterBooking.load', 'Load')}
                </button>
              </div>
            </label>
          </div>
        </section>

        {/* Card 2: Seat Map & Booking Result (middle on mobile/tablet, right column on lg+) */}
        <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 sm:p-6 shadow-sm min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <div className="mb-5 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-on-surface">{t('staffCounterBooking.seatMap', 'Sơ đồ ghế')}</h3>
              <p className="text-xs text-on-surface-variant">{t('staffCounterBooking.seatMapDesc', 'Chỉ ghế trống mới được đặt tại quầy.')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded border border-outline-variant bg-surface-container inline-block" />
                {t('staffCounterBooking.available', 'Available')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 inline-block" />
                VIP
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded border border-pink-500/40 bg-pink-500/10 text-pink-600 dark:text-pink-400 inline-block" />
                Couple
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded border border-outline-variant/20 bg-surface-container-high/60 inline-block" />
                {t('staffCounterBooking.soldHold', 'Sold/Hold')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-primary inline-block" />
                {t('staffCounterBooking.seatSelected', 'Selected')}
              </span>
            </div>
          </div>

          {!seatMap ? (
            <div className="flex min-h-[240px] sm:min-h-[320px] items-center justify-center rounded-xl bg-surface-container-low text-sm text-on-surface-variant px-4 text-center">
              {t('staffCounterBooking.selectToStart', 'Chọn phim và suất chiếu để bắt đầu.')}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center">
                <div className="w-3/4 max-w-md h-1.5 rounded-full bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-outline mt-1.5">
                  {t('booking.screen', 'MÀN HÌNH')}
                </span>
              </div>
              <div className="space-y-2.5 overflow-x-auto touch-pan-x pb-2 no-scrollbar">
                {seatMap.rows.map((row) => (
                  <div key={row.rowLabel} className="flex items-center gap-2 sm:gap-3 min-w-max">
                    <span className="w-6 text-xs font-bold text-on-surface-variant shrink-0">{row.rowLabel}</span>
                    <div className="flex gap-1.5 sm:gap-2">
                      {row.seats.map((seat) => {
                        const selected = selectedSeats.some((item) => item.numericId === seat.numericId);
                        const unavailable = seat.status !== 'available' || seat.isPathway;
                        return (
                          <button
                            key={seat.id}
                            onClick={() => toggleSeat(seat)}
                            disabled={unavailable}
                            className={`h-10 rounded-lg border px-2.5 sm:px-3 text-xs font-bold transition-all ${selected
                                ? 'border-primary bg-primary text-white shadow-md shadow-primary/25 scale-[1.02]'
                                : unavailable
                                  ? 'border-outline-variant/20 bg-surface-container-high/60 text-on-surface-variant/40 cursor-not-allowed'
                                  : seat.type === 'vip'
                                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/60'
                                    : seat.type === 'couple'
                                      ? 'border-pink-500/40 bg-pink-500/10 text-pink-700 dark:text-pink-300 hover:bg-pink-500/20 hover:border-pink-500/60'
                                      : 'border-outline-variant bg-surface-container text-on-surface hover:border-primary hover:bg-surface-container-high'
                              }`}
                            style={{ minWidth: `${Math.max(40, seat.columnSpan * 42)}px` }}
                          >
                            {seat.isPathway ? 'PATH' : seat.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && (
            <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:p-5 text-emerald-800 dark:text-emerald-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle className="w-5 h-5 shrink-0" />
                  <span>{t('staffCounterBooking.paidBooking', { id: result.id, defaultValue: 'Booking #{{id}} đã thanh toán' })}</span>
                </div>
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  disabled={isPrintingReceipt}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors disabled:opacity-50"
                >
                  {isPrintingReceipt ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  <span>{t('staffTicketLookup.printPdfAction', 'Print PDF')}</span>
                </button>
              </div>
              <p className="text-sm">
                {result.displayTitle || result.movieTitle || result.eventTitle || 'Showtime'} -{' '}
                {result.seatLabels?.join(', ') || 'N/A'} - {formatVND(Number(result.finalAmount || 0))}
              </p>
              <p className="text-xs break-all">
                {t('staffCounterBooking.ticket', 'Ticket:')} {result.tickets?.map((ticket) => ticket.ticketCode).join(', ') || t('staffCounterBooking.updating', 'Đang cập nhật')}
              </p>
            </div>
          )}
        </section>

        {/* Card 3: Customer, Payment & Confirm (bottom on mobile/tablet, bottom-left on lg+) */}
        <aside className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 sm:p-6 shadow-sm lg:col-start-1 lg:row-start-2">
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('staffCounterBooking.customerPhone', 'Số điện thoại')}</span>
              <div className="mt-1 flex gap-2">
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(event) => {
                    setCustomerPhone(event.target.value);
                    if (memberUser) {
                      setMemberUser(null);
                      setLookupNotice(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleLookupMember();
                    }
                  }}
                  className="flex-1 min-w-0 w-full min-h-[44px] rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-base sm:text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="090..."
                />
                <button
                  type="button"
                  onClick={handleLookupMember}
                  disabled={isLookingUp || !customerPhone.trim()}
                  className="rounded-lg bg-surface-container-high px-3 min-h-[44px] text-xs font-bold text-on-surface hover:bg-surface-container-highest disabled:opacity-50 shrink-0 border border-outline-variant/50 flex items-center gap-1.5"
                >
                  {isLookingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('staffCounterBooking.findMember', 'Tra cứu')}
                </button>
              </div>
            </label>

            {memberUser ? (
              <div className="bg-primary/10 border border-primary/30 p-2.5 rounded-lg flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-primary truncate">
                    {memberUser.fullName} ({t('staffCounterBooking.memberTier', { tier: memberUser.tier || 'Standard', defaultValue: `${memberUser.tier || 'Standard'} Member` })})
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {t('staffCounterBooking.loyaltyPoints', { points: memberUser.loyaltyPoints ?? 0, defaultValue: `Điểm tích lũy: ${memberUser.loyaltyPoints ?? 0} pts` })}
                  </p>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary text-white shrink-0">
                  {t('staffCounterBooking.earnPoints', 'Tích điểm')}
                </span>
              </div>
            ) : lookupNotice ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">{lookupNotice}</p>
            ) : null}

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('staffCounterBooking.customerName', 'Tên khách')}</span>
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-base sm:text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder={t('staffCounterBooking.customerNamePlaceholder', 'Walk-in Customer')}
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('staffCounterBooking.paymentMethod', 'Thanh toán')}</span>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as 'CASH' | 'CARD' | 'BANK_TRANSFER')}
                className="mt-1 w-full min-h-[44px] rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-base sm:text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="CASH" className="bg-surface-container text-on-surface">{t('staffCounterBooking.cash', 'Tiền mặt')}</option>
                <option value="CARD" className="bg-surface-container text-on-surface">{t('staffCounterBooking.card', 'Thẻ')}</option>
                <option value="BANK_TRANSFER" className="bg-surface-container text-on-surface">{t('staffCounterBooking.bankTransfer', 'Chuyển khoản')}</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('staffCounterBooking.voucher', 'Voucher')}</span>
              <input
                autoCapitalize="characters"
                value={voucherCode}
                onChange={(event) => setVoucherCode(event.target.value.toUpperCase())}
                className="mt-1 w-full min-h-[44px] rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-base sm:text-sm uppercase text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="WELCOME10"
              />
            </label>
          </div>

          <div className="mt-6 rounded-xl bg-surface-container-low p-4 border border-outline-variant/30">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('staffCounterBooking.selected', 'Đã chọn')}</p>
            <p className="mt-1 text-lg font-extrabold text-on-surface">
              {selectedSeats.map((seat) => seat.label).join(', ') || t('staffCounterBooking.noSeatSelected', 'Chưa chọn ghế')}
            </p>
            <p className="mt-2 text-sm font-semibold text-primary">{formatVND(subtotal)}</p>
          </div>

          <button
            onClick={submitBooking}
            disabled={isSubmitting || selectedSeats.length === 0}
            className="mt-6 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
            {t('staffCounterBooking.confirmBooking', 'Xác nhận đặt vé')}
          </button>
        </aside>
      </div>

      {/* Quick Mobile/Tablet Sticky Confirm Bar when seats are picked (< lg) */}
      {selectedSeats.length > 0 && (
        <div className="lg:hidden fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] md:bottom-0 inset-x-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant px-4 py-3 shadow-2xl">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-on-surface-variant truncate">
                {selectedSeats.map((s) => s.label).join(', ')}
              </p>
              <p className="text-base font-black text-primary">{formatVND(subtotal)}</p>
            </div>
            <button
              type="button"
              onClick={submitBooking}
              disabled={isSubmitting}
              className="min-h-[44px] px-5 rounded-xl bg-primary text-on-primary text-xs font-bold flex items-center gap-2 shrink-0 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
              <span>{t('staffCounterBooking.confirmBooking', 'Xác nhận đặt vé')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Hidden printable receipt tickets */}
      {result && printableTickets.length > 0 && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
          <div id={`printable-counter-batch-${result.id}`} className="flex flex-col gap-4 bg-surface-container p-8">
            {printableTickets.map((ticket) => (
              <PrintableTicket key={ticket.ticketCode} ticket={ticket} />
            ))}
          </div>
        </div>
      )}
    </StaffLayout>
  );
};
