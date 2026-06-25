import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle, Download, Share2, Ticket } from 'lucide-react';
import { useBookingStore } from '../../store/bookingStore';
import { formatVND, formatShowtime } from '../../utils/formatters';
import { downloadElementAsPDF } from '../../utils/pdfGenerator';
import { useState } from 'react';
import { PrintableTicket } from '../../components/PrintableTicket';
import { TicketDetails } from '../../types/booking';

export const CheckoutSuccess: React.FC = () => {
  const navigate = useNavigate();
  const { completedOrder, showtimeData, movieTitle, selectedSeats, clearSelection } = useBookingStore();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    if (!completedOrder) return;
    setIsDownloading(true);
    try {
      await downloadElementAsPDF(`printable-batch-${completedOrder.id}`, `tickets-order-${completedOrder.id}.pdf`);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const printableTickets: TicketDetails[] = (completedOrder?.tickets || []).map(t => {
    // Attempt to match the ticket to the selected seat
    // @ts-ignore - BackendTicket type is strict, but runtime might have extra fields, we rely on showtimeSeatId
    const seatId = (t as any).showtimeSeatId;
    const seat = selectedSeats.find(s => s.numericId === seatId);
    
    // Get time from showtimeData
    const startTime = showtimeData?.startTime || '';
    const dt = startTime ? new Date(startTime) : null;
    
    return {
      ticketCode: t.ticketCode,
      orderId: completedOrder?.id || 0,
      movieTitle: showtimeData?.displayTitle || showtimeData?.eventName || movieTitle || 'Vé xem phim',
      cinemaName: showtimeData?.cinemaName || '',
      hallName: showtimeData?.roomName || '',
      showtime: startTime,
      date: dt ? dt.toLocaleDateString('vi-VN') : '',
      time: dt ? dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '',
      seats: seat ? [seat.label] : [],
      seatLabel: seat ? seat.label : '',
      seatTypeName: seat ? seat.type : '',
      qrCodeData: t.qrCodeData,
      price: Number(t.price || 0),
      status: t.status,
      posterUrl: ''
    };
  });

  // Clear selection on unmount so the store is ready for the next booking
  useEffect(() => {
    return () => {
      // Delay clear so TicketInfo can still read completedOrder on immediate nav
    };
  }, []);

  if (!completedOrder) {
    // Shouldn't happen in normal flow; redirect home if accessed directly
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center px-6 py-20">
        <div className="text-center space-y-4">
          <p className="text-on-surface-variant">Không tìm thấy thông tin đặt vé.</p>
          <Link to="/" className="text-primary font-semibold hover:underline">
            Về trang chủ
          </Link>
        </div>
      </main>
    );
  }

  const firstTicket = completedOrder.tickets?.[0];
  const firstTicketCode = firstTicket?.ticketCode ?? '';

  // Parse seat labels from seatIdsSnapshot (comma-separated seat IDs — not labels)
  // We display them as "Ghế X" or rely on the stored selected seats
  const seatCount = completedOrder.seatIdsSnapshot?.split(',').filter(Boolean).length ?? 0;

  const showtimeLabel = showtimeData ? formatShowtime(showtimeData.startTime) : '—';

  const handleGoHome = () => {
    clearSelection();
    navigate('/');
  };

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center px-6 py-20">
      <div className="max-w-2xl w-full bg-surface-container-lowest rounded-2xl shadow-xl p-10 text-center">
        {/* Success icon */}
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary mx-auto mb-2 animate-bounce-once">
          <CheckCircle className="w-10 h-10" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight mt-6 text-on-surface">
          Thanh toán thành công!
        </h1>
        <p className="text-on-surface-variant mt-3">
          Ghế của bạn đã được đặt. Vé điện tử đã được tạo và gửi đến email của bạn.
        </p>

        {/* Booking info card */}
        <div className="mt-8 bg-surface-container-low p-6 rounded-xl text-left">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                Mã đơn hàng
              </p>
              <p className="text-lg font-bold text-on-surface">#{completedOrder.id}</p>
            </div>
            <span className="px-3 py-1 bg-primary text-white text-[10px] uppercase tracking-widest rounded font-bold">
              Đã thanh toán
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-on-surface-variant mb-1">Phim</p>
              <p className="font-semibold text-on-surface">{movieTitle ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant mb-1">Suất chiếu</p>
              <p className="font-semibold text-on-surface">{showtimeLabel}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant mb-1">Số ghế</p>
              <p className="font-semibold text-on-surface">{seatCount} ghế</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant mb-1">Tổng tiền</p>
              <p className="font-semibold text-primary">{formatVND(parseFloat(completedOrder.finalAmount))}</p>
            </div>
          </div>

          {/* Tickets list */}
          {completedOrder.tickets && completedOrder.tickets.length > 0 && (
            <div className="mt-6 pt-4 border-t border-outline-variant/20">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-3">
                Mã vé
              </p>
              <div className="flex flex-wrap gap-2">
                {completedOrder.tickets.map((t) => (
                  <Link
                    key={t.ticketCode}
                    to={`/user/tickets/${t.ticketCode}`}
                    className="px-3 py-1 bg-primary/10 text-primary text-sm font-mono font-bold rounded hover:bg-primary/20 transition-colors"
                  >
                    {t.ticketCode}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-8 flex flex-col md:flex-row gap-4">
          {firstTicketCode ? (
            <Link
              to={`/user/tickets/${firstTicketCode}`}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              <Ticket className="w-4 h-4" />
              Xem vé
            </Link>
          ) : null}
          <button
            className="flex-1 flex items-center justify-center gap-2 bg-white border border-outline-variant py-3 rounded-lg font-semibold hover:bg-surface-container-low transition-colors"
            onClick={handleDownloadPDF}
            disabled={isDownloading}
          >
            <Download className="w-4 h-4" />
            {isDownloading ? 'Đang tải...' : 'In vé'}
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-2 bg-white border border-outline-variant py-3 rounded-lg font-semibold hover:bg-surface-container-low transition-colors"
            onClick={handleGoHome}
          >
            <Share2 className="w-4 h-4" />
            Về trang chủ
          </button>
        </div>
      </div>

      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        <div id={`printable-batch-${completedOrder.id}`} className="flex flex-col gap-8 bg-gray-100 p-8">
          {printableTickets.map((t, idx) => (
            <PrintableTicket key={idx} ticket={t} />
          ))}
        </div>
      </div>
    </main>
  );
};
