import React, { useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SiteTopNav } from '../../components/SiteTopNav';
import { useTicketDetails } from '../../hooks/useTicketDetails';
import { bookingService } from '../../services/bookingService';
import { formatVND } from '../../utils/formatters';
import { AlertCircle, Download, Printer } from 'lucide-react';
import genericPoster from '../../resources/generic_movie_poster.png';
import { QRCodeSVG } from 'qrcode.react';
import { downloadElementAsPDF } from '../../utils/pdfGenerator';

export const TicketInfo: React.FC = () => {
  const { ticketId: ticketCode = '' } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { ticket, isLoading, error } = useTicketDetails(ticketCode);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      await downloadElementAsPDF('ticket-content', `ticket-${ticketCode}.pdf`);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCancel = useCallback(async () => {
    if (!ticket?.orderId) return;
    if (!window.confirm('Bạn có chắc muốn huỷ vé và yêu cầu hoàn tiền?')) return;
    setCancelLoading(true);
    setCancelError(null);
    try {
      await bookingService.refundOrder(ticket.orderId, 'Khách hàng yêu cầu huỷ');
      navigate('/my-tickets');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setCancelError(e?.response?.data?.message || 'Không thể huỷ vé lúc này.');
    } finally {
      setCancelLoading(false);
    }
  }, [ticket, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant animate-pulse">Đang tải vé...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-error mx-auto" />
          <p className="text-on-surface-variant">{error ?? 'Không tìm thấy vé.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-primary font-semibold hover:underline text-sm"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  const statusColor =
    ticket.status === 'VALID'
      ? 'bg-primary text-on-primary'
      : ticket.status === 'CHECKED_IN'
      ? 'bg-green-600 text-white'
      : 'bg-error text-white';

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <SiteTopNav activeLabel="My Tickets" showSearch={false} />
      <main className="pt-24 pb-32 px-4 md:px-6 max-w-4xl mx-auto min-h-screen">
        <div className="mb-8">
          <button
            className="flex items-center gap-2 text-sm font-medium text-on-surface-variant hover:text-primary transition-colors"
            onClick={() => navigate(-1)}
          >
            ← Quay lại
          </button>
        </div>

        <div id="ticket-content" className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start p-4 bg-surface -m-4 rounded-xl">
          {/* Left: poster placeholder or QR */}
          <div className="lg:col-span-5 space-y-8">
            <div className="aspect-[2/3] w-full rounded-xl overflow-hidden shadow-2xl relative bg-surface-container-high flex items-center justify-center">
              <img
                alt={ticket.movieTitle || 'Movie'}
                className="w-full h-full object-cover"
                src={ticket.posterUrl || genericPoster}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = genericPoster;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/80 to-transparent" />
              <div className="absolute bottom-6 left-6">
                <span className={`inline-block px-3 py-1 text-[10px] font-bold tracking-widest uppercase mb-2 rounded ${statusColor}`}>
                  {ticket.status}
                </span>
                {ticket.movieTitle && (
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {ticket.movieTitle.toUpperCase()}
                  </h2>
                )}
              </div>
            </div>
            <div className="bg-surface-container-low p-6 rounded-xl">
              <p className="text-xs text-on-secondary-container leading-relaxed">
                Vui lòng đến trước 20 phút. Vé điện tử phải được xuất trình tại cửa vào phòng chiếu.
              </p>
            </div>
          </div>

          {/* Right: ticket details */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="relative bg-surface-container-lowest rounded-xl shadow-lg overflow-hidden flex flex-col">
              <div className="p-8 pb-10">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h1 className="text-3xl font-black text-on-surface tracking-tighter mb-1">
                      {(ticket.movieTitle || 'VÉ XEM PHIM').toUpperCase()}
                    </h1>
                    {ticket.cinemaName && (
                      <p className="text-sm font-medium text-primary tracking-wide">
                        {ticket.cinemaName}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">
                      Mã vé
                    </span>
                    <span className="text-base font-mono font-semibold text-on-surface">
                      {ticket.ticketCode}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-8 gap-x-4">
                  <div>
                    <label className="text-[10px] font-bold tracking-widest uppercase text-outline mb-2 block">
                      Ngày
                    </label>
                    <p className="text-lg font-semibold text-on-surface">{ticket.date || '—'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold tracking-widest uppercase text-outline mb-2 block">
                      Giờ
                    </label>
                    <p className="text-lg font-semibold text-on-surface">{ticket.time || '—'}</p>
                  </div>
                  {ticket.hallName && (
                    <div>
                      <label className="text-[10px] font-bold tracking-widest uppercase text-outline mb-2 block">
                        Phòng chiếu
                      </label>
                      <p className="text-lg font-semibold text-on-surface">{ticket.hallName}</p>
                    </div>
                  )}
                  {(ticket.seatLabel || ticket.seats.length > 0) && (
                    <div>
                      <label className="text-[10px] font-bold tracking-widest uppercase text-outline mb-2 block">
                        Ghế
                      </label>
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-2 flex-wrap">
                          {ticket.seatLabel ? (
                            <span className="px-3 py-1 bg-surface-container-high rounded font-bold text-on-primary-fixed-variant">
                              {ticket.seatLabel}
                            </span>
                          ) : (
                            ticket.seats.map((seat) => (
                              <span
                                key={seat}
                                className="px-3 py-1 bg-surface-container-high rounded font-bold text-on-primary-fixed-variant"
                              >
                                {seat}
                              </span>
                            ))
                          )}
                        </div>
                        {ticket.seatTypeName && (
                          <span className="text-xs font-medium text-on-surface-variant mt-1">
                            Loại ghế: <span className="text-primary">{ticket.seatTypeName}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-outline mb-2 block">
                      Giá vé
                    </label>
                    <p className="text-xl font-bold text-primary">{formatVND(ticket.price)}</p>
                  </div>
                </div>
              </div>

              {/* Tear line */}
              <div className="relative h-6 flex items-center">
                <div className="absolute -left-3 w-6 h-6 bg-surface rounded-full" />
                <div className="absolute -right-3 w-6 h-6 bg-surface rounded-full" />
                <div className="w-full border-t-2 border-dashed border-outline-variant mx-6" />
              </div>

              {/* QR section */}
              <div className="p-10 bg-surface-container-low flex flex-col items-center justify-center">
                {ticket.qrCodeData ? (
                  <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex justify-center">
                    <QRCodeSVG 
                      value={ticket.qrCodeData}
                      size={160}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                ) : (
                  <div className="w-40 h-40 bg-surface-container-high rounded-lg mb-6 flex items-center justify-center">
                    <p className="text-xs text-on-surface-variant text-center px-4">QR không khả dụng</p>
                  </div>
                )}
                <p className="text-[10px] font-bold tracking-widest uppercase text-outline mb-4">
                  Quét tại cửa vào
                </p>
                <div className="flex gap-4 w-full">
                  <button
                    className="flex-1 flex items-center justify-center gap-2 bg-on-surface text-white py-3 rounded-lg font-semibold text-sm hover:bg-on-surface/90 transition-all"
                    onClick={() => window.print()}
                  >
                    <Printer className="w-4 h-4" />
                    In vé
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-2 bg-white border border-outline-variant text-on-surface py-3 rounded-lg font-semibold text-sm hover:bg-surface-container-lowest transition-all"
                    onClick={handleDownloadPDF}
                    disabled={isDownloading}
                  >
                    <Download className="w-4 h-4" />
                    {isDownloading ? 'Đang tải...' : 'Tải xuống'}
                  </button>
                </div>
              </div>
            </div>

            {cancelError && (
              <div className="flex items-start gap-2 bg-error/10 text-error border border-error/30 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-xs font-medium">{cancelError}</p>
              </div>
            )}

            <div className="flex justify-between items-center px-2">
              <button
                className="text-sm font-medium text-error hover:underline disabled:opacity-50"
                onClick={handleCancel}
                disabled={cancelLoading || ticket.status !== 'VALID'}
              >
                {cancelLoading ? 'Đang huỷ...' : 'Huỷ vé & hoàn tiền'}
              </button>
              <button
                className="text-sm font-medium text-primary hover:underline"
                onClick={() => navigator.share?.({ title: ticket.ticketCode, text: `Vé xem phim: ${ticket.ticketCode}` })}
              >
                Chia sẻ
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
