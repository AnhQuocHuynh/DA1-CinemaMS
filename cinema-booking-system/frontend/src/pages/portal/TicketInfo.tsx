import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { SiteTopNav } from '../../components/SiteTopNav';
import { useTicketDetails } from '../../hooks/useTicketDetails';
import { formatVND } from '../../utils/formatters';
import { AlertCircle, Maximize2, Printer, Share2, X } from 'lucide-react';
import genericPoster from '../../resources/generic_movie_poster.png';
import { QRCodeSVG } from 'qrcode.react';
import { downloadElementAsPDF } from '../../utils/pdfGenerator';
import { PrintableTicket } from '../../components/PrintableTicket';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from 'react-i18next';

export const TicketInfo: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { ticketId: ticketCode = '' } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { ticket, isLoading, error } = useTicketDetails(ticketCode);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showFullscreenQR, setShowFullscreenQR] = useState(false);

  const handleShare = async () => {
    if (!ticket) return;
    const shareTitle = ticket.ticketCode;
    const shareText = `${t('ticketInfo.movieTicket')}: ${ticket.ticketCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: window.location.href });
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      addToast(t('ticketInfo.linkCopied', 'Ticket link copied to clipboard.'), 'success');
    } catch {
      addToast(t('ticketInfo.shareFailed', 'Unable to share ticket.'), 'error');
    }
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      await downloadElementAsPDF('printable-ticket-content', `ticket-${ticketCode}.pdf`);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant animate-pulse">{t('ticketInfo.loading')}</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-error mx-auto" />
          <p className="text-on-surface-variant">{error ?? t('ticketInfo.notFound')}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-primary font-semibold hover:underline text-sm"
          >
            {t('ticketInfo.goBack')}
          </button>
        </div>
      </div>
    );
  }

  const statusColor =
    ticket.status === 'VALID'
      ? 'bg-primary text-on-primary'
      : ticket.status === 'CHECKED_IN'
      ? 'bg-success text-white'
      : 'bg-error text-on-error';

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <SiteTopNav activeLabel="My Tickets" showSearch={false} />
      <main className="pt-20 md:pt-24 pb-28 md:pb-32 px-4 md:px-6 max-w-4xl mx-auto min-h-screen">
        <div className="mb-4 sm:mb-8">
          <button
            className="inline-flex items-center gap-2 min-h-[44px] px-2 -ml-2 text-sm font-medium text-on-surface-variant hover:text-primary transition-colors"
            onClick={() => navigate(-1)}
          >
            ← {t('ticketInfo.goBack')}
          </button>
        </div>

        <div id="ticket-content" className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-start p-0 sm:p-4 bg-surface sm:-m-4 rounded-xl">
          {/* Left: poster placeholder (second on mobile so QR is above the fold) */}
          <div className="lg:col-span-5 space-y-6 order-2 lg:order-1">
            <div className="aspect-[2/3] w-full max-w-[260px] mx-auto lg:max-w-none rounded-xl overflow-hidden shadow-2xl relative bg-surface-container-high flex items-center justify-center">
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
              <div className="absolute bottom-6 left-6 right-6">
                <span className={`inline-block px-3 py-1 text-[10px] font-bold tracking-widest uppercase mb-2 rounded ${statusColor}`}>
                  {t(`userDashboard.status.${ticket.status}`, ticket.status)}
                </span>
                {ticket.movieTitle && (
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {ticket.movieTitle.toUpperCase()}
                  </h2>
                )}
              </div>
            </div>
            <div className="bg-surface-container-low p-4 sm:p-6 rounded-xl">
              <p className="text-xs text-on-secondary-container leading-relaxed">
                {t('ticketInfo.arriveEarly')}
              </p>
            </div>
          </div>

          {/* Right: ticket details + QR */}
          <div className="lg:col-span-7 flex flex-col gap-5 sm:gap-6 order-1 lg:order-2">
            <div className="relative bg-surface-container-lowest rounded-xl shadow-lg overflow-hidden flex flex-col">
              <div className="p-4 sm:p-8 pb-6 sm:pb-10">
                <div className="flex flex-wrap justify-between items-start gap-3 mb-6 sm:mb-8">
                  <div className="min-w-0 flex-1">
                    <h1 className="text-xl sm:text-3xl font-black text-on-surface tracking-tighter mb-1">
                      {(ticket.movieTitle || t('ticketInfo.movieTicket')).toUpperCase()}
                    </h1>
                    {ticket.cinemaName && (
                      <p className="text-sm font-medium text-primary tracking-wide">
                        {ticket.cinemaName}
                      </p>
                    )}
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">
                      {t('ticketInfo.ticketCode')}
                    </span>
                    <span className="text-sm sm:text-base font-mono font-semibold text-on-surface">
                      {ticket.ticketCode}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 sm:gap-y-8 gap-x-4">
                  <div>
                    <label className="text-[10px] font-bold tracking-widest uppercase text-outline mb-2 block">
                      {t('ticketInfo.date')}
                    </label>
                    <p className="text-lg font-semibold text-on-surface">{ticket.date || '—'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold tracking-widest uppercase text-outline mb-2 block">
                      {t('ticketInfo.time')}
                    </label>
                    <p className="text-lg font-semibold text-on-surface">{ticket.time || '—'}</p>
                  </div>
                  {ticket.hallName && (
                    <div>
                      <label className="text-[10px] font-bold tracking-widest uppercase text-outline mb-2 block">
                        {t('ticketInfo.room')}
                      </label>
                      <p className="text-lg font-semibold text-on-surface">{ticket.hallName}</p>
                    </div>
                  )}
                  {(ticket.seatLabel || ticket.seats.length > 0) && (
                    <div>
                      <label className="text-[10px] font-bold tracking-widest uppercase text-outline mb-2 block">
                        {t('ticketInfo.seat')}
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
                            {t('ticketInfo.seatType')}: <span className="text-primary">{ticket.seatTypeName}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-outline mb-2 block">
                      {t('ticketInfo.price')}
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
              <div className="p-5 sm:p-10 bg-surface-container-low flex flex-col items-center justify-center">
                {ticket.qrCodeData ? (
                  <button
                    type="button"
                    onClick={() => setShowFullscreenQR(true)}
                    className="bg-white p-4 rounded-xl shadow-sm mb-4 flex flex-col items-center gap-2 hover:ring-2 hover:ring-primary transition-all"
                    aria-label={t('ticketInfo.fullscreenQr', 'Enlarge QR code')}
                  >
                    <QRCodeSVG
                      value={ticket.qrCodeData}
                      size={176}
                      level="H"
                      includeMargin={true}
                    />
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                      <Maximize2 className="w-3.5 h-3.5" />
                      {t('ticketInfo.tapToEnlarge', 'Tap to enlarge')}
                    </span>
                  </button>
                ) : (
                  <div className="w-40 h-40 bg-surface-container-high rounded-lg mb-6 flex items-center justify-center">
                    <p className="text-xs text-on-surface-variant text-center px-4">{t('ticketInfo.qrUnavailable')}</p>
                  </div>
                )}
                <p className="text-[10px] font-bold tracking-widest uppercase text-outline mb-4 text-center">
                  {t('ticketInfo.scanAtEntrance')}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <button
                    className="flex-1 flex items-center justify-center gap-2 bg-on-surface text-white py-3 min-h-[44px] rounded-lg font-semibold text-sm hover:bg-on-surface/90 transition-all"
                    onClick={handleDownloadPDF}
                    disabled={isDownloading}
                  >
                    <Printer className="w-4 h-4" />
                    {isDownloading ? t('ticketInfo.downloading') : t('ticketInfo.printTicket')}
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="sm:w-auto flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface font-semibold text-sm hover:bg-surface-container transition-all"
                  >
                    <Share2 className="w-4 h-4" />
                    {t('ticketInfo.share')}
                  </button>
                </div>
              </div>
            </div>

            {ticket.orderId && (
              <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-on-surface-variant">
                  {t('ticketInfo.belongsToOrder', { orderId: ticket.orderId })}
                </div>
                <Link
                  to="/my-tickets"
                  className="text-xs font-semibold text-primary hover:underline shrink-0 min-h-[36px] inline-flex items-center"
                >
                  {t('ticketInfo.manageOrderRefund')} &rarr;
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Fullscreen High-Contrast QR Modal */}
        {showFullscreenQR && ticket.qrCodeData && (
          <div
            className="fixed inset-0 z-[100] bg-white text-black flex flex-col items-center justify-center p-6"
            onClick={() => setShowFullscreenQR(false)}
          >
            <button
              type="button"
              onClick={() => setShowFullscreenQR(false)}
              className="absolute top-6 right-6 w-12 h-12 rounded-full bg-zinc-100 text-zinc-900 flex items-center justify-center shadow-sm"
              aria-label={t('common.close', 'Close')}
            >
              <X className="w-6 h-6" />
            </button>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
              {ticket.cinemaName}
            </p>
            <h2 className="text-xl font-black text-center mb-6 max-w-xs">
              {(ticket.movieTitle || t('ticketInfo.movieTicket')).toUpperCase()}
            </h2>
            <div className="p-4 bg-white rounded-2xl border-2 border-zinc-200 shadow-lg">
              <QRCodeSVG value={ticket.qrCodeData} size={260} level="H" includeMargin={true} />
            </div>
            <p className="mt-6 font-mono text-lg font-bold tracking-wider">{ticket.ticketCode}</p>
            <p className="mt-2 text-xs text-zinc-500 text-center">
              {t('ticketInfo.scanAtEntrance')}
            </p>
          </div>
        )}

        {/* Hidden printable layout */}
        <div id="printable-ticket-content" style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
          <PrintableTicket ticket={ticket} />
        </div>
      </main>
    </div>
  );
};
