import React, { useMemo, useState, useEffect } from 'react';
import { CheckCircle, Loader2, Ticket, UserRound } from 'lucide-react';
import { StaffLayout } from '../../components/staff/StaffLayout';
import { bookingService } from '../../services/bookingService';
import { staffService } from '../../services/staffService';
import { movieService, MovieResponse } from '../../services/movieService';
import { showtimeService } from '../../services/showtimeService';
import { ShowtimeResponse } from '../../types/showtime';
import { Seat, SeatMap } from '../../types/booking';
import { StaffCounterBookingResult } from '../../types/staff';
import { formatVND } from '../../utils/formatters';

export const CounterBooking: React.FC = () => {
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
  const [error, setError] = useState<string | null>(null);

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
      setError('Vui lòng chọn suất chiếu hợp lệ.');
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
      setError('Không thể tải sơ đồ ghế cho suất chiếu này.');
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

  const submitBooking = async () => {
    const numericShowtimeId = Number(showtimeId);
    if (!numericShowtimeId || selectedSeats.length === 0) {
      setError('Vui lòng chọn suất chiếu và ít nhất một ghế.');
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
        voucherCode: voucherCode || null,
        paymentMethod,
      });
      setResult(booking);
      setSeatMap(null);
      setSelectedSeats([]);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Không thể tạo booking tại quầy.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <StaffLayout activeItemId="counter-booking" searchPlaceholder="Nhập mã vé hoặc ID...">
      <section className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="text-[0.65rem] uppercase tracking-[0.15em] font-bold text-slate-400 mb-1 block">
            Counter Sales
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface">Đặt vé tại quầy</h2>
          <p className="text-slate-500 mt-2 text-sm max-w-xl">
            Chọn suất chiếu, ghế trống và xác nhận thanh toán trực tiếp để in/xuất mã vé ngay.
          </p>
        </div>
      </section>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <aside className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-full bg-blue-50 text-primary flex items-center justify-center">
              <UserRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Thông tin booking</h3>
              <p className="text-xs text-slate-500">Khách vãng lai không cần tài khoản</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Chọn Phim</span>
              <select
                value={selectedMovieId}
                onChange={handleMovieChange}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">-- Chọn phim --</option>
                {movies.map(m => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Chọn Suất Chiếu</span>
              <div className="mt-1 flex gap-2">
                <select
                  value={showtimeId}
                  onChange={(e) => {
                    setShowtimeId(e.target.value);
                    setSeatMap(null);
                    setSelectedSeats([]);
                  }}
                  disabled={!selectedMovieId || showtimes.length === 0}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:bg-slate-50"
                >
                  <option value="">-- Chọn suất chiếu --</option>
                  {showtimes.map(st => {
                    const date = new Date(st.startTime);
                    const formattedDate = date.toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' });
                    const formattedTime = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <option key={st.id} value={st.id}>
                        {formattedDate} {formattedTime} - {st.roomName || 'Room ' + st.roomId}
                      </option>
                    );
                  })}
                </select>
                <button
                  onClick={loadSeats}
                  disabled={isLoadingSeats || !showtimeId}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60 shrink-0"
                >
                  {isLoadingSeats ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load'}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Tên khách</span>
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="Walk-in Customer"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Số điện thoại</span>
              <input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="090..."
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Thanh toán</span>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="CASH">Tiền mặt</option>
                <option value="CARD">Thẻ</option>
                <option value="BANK_TRANSFER">Chuyển khoản</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Voucher</span>
              <input
                value={voucherCode}
                onChange={(event) => setVoucherCode(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase outline-none focus:ring-2 focus:ring-primary"
                placeholder="WELCOME10"
              />
            </label>
          </div>

          <div className="mt-6 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Đã chọn</p>
            <p className="mt-1 text-lg font-extrabold text-slate-900">
              {selectedSeats.map((seat) => seat.label).join(', ') || 'Chưa chọn ghế'}
            </p>
            <p className="mt-2 text-sm font-semibold text-primary">{formatVND(subtotal)}</p>
          </div>

          <button
            onClick={submitBooking}
            disabled={isSubmitting || selectedSeats.length === 0}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
            Xác nhận đặt vé
          </button>
        </aside>

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Sơ đồ ghế</h3>
              <p className="text-xs text-slate-500">Chỉ ghế trống mới được đặt tại quầy.</p>
            </div>
            <div className="flex gap-3 text-xs text-slate-500">
              <span>Available</span>
              <span>Sold/Hold</span>
              <span>Selected</span>
            </div>
          </div>

          {!seatMap ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">
              Chọn phim và suất chiếu để bắt đầu.
            </div>
          ) : (
            <div className="space-y-3 overflow-x-auto pb-2">
              {seatMap.rows.map((row) => (
                <div key={row.rowLabel} className="flex items-center gap-3">
                  <span className="w-6 text-xs font-bold text-slate-400">{row.rowLabel}</span>
                  <div className="flex gap-2">
                    {row.seats.map((seat) => {
                      const selected = selectedSeats.some((item) => item.numericId === seat.numericId);
                      const unavailable = seat.status !== 'available' || seat.isPathway;
                      return (
                        <button
                          key={seat.id}
                          onClick={() => toggleSeat(seat)}
                          disabled={unavailable}
                          className={`h-10 rounded-lg border px-3 text-xs font-bold transition-all ${
                            selected
                              ? 'border-primary bg-primary text-white'
                              : unavailable
                                ? 'border-slate-100 bg-slate-100 text-slate-300'
                                : seat.type === 'vip'
                                  ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                  : seat.type === 'couple'
                                    ? 'border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-primary'
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
          )}

          {result && (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5 text-green-800">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle className="w-5 h-5" />
                Booking #{result.id} đã thanh toán
              </div>
              <p className="mt-2 text-sm">
                {result.displayTitle || result.movieTitle || result.eventTitle || 'Showtime'} -{' '}
                {result.seatLabels?.join(', ') || 'N/A'} - {formatVND(Number(result.finalAmount || 0))}
              </p>
              <p className="mt-1 text-xs">
                Ticket: {result.tickets?.map((ticket) => ticket.ticketCode).join(', ') || 'Đang cập nhật'}
              </p>
            </div>
          )}
        </section>
      </div>
    </StaffLayout>
  );
};
