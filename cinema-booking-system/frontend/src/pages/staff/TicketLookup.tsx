import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, FileText, Loader2, Search } from 'lucide-react';
import { StaffLayout } from '../../components/staff/StaffLayout';
import { useStaffValidation } from '../../hooks/useStaffValidation';
import { bookingService } from '../../services/bookingService';
import { staffService } from '../../services/staffService';
import { PrintableTicket } from '../../components/PrintableTicket';
import { downloadElementAsPDF } from '../../utils/pdfGenerator';
import { TicketDetails } from '../../types/booking';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from 'react-i18next';

export const TicketLookup: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { stats, bookings, isLoading, reload } = useStaffValidation();
  const [ticketsToPrint, setTicketsToPrint] = useState<{ tickets: TicketDetails[], bookingId: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'validated'>('all');

  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bookings.filter((booking) => {
      if (statusFilter === 'pending' && booking.status !== 'pending') return false;
      if (statusFilter === 'validated' && booking.status === 'pending') return false;
      if (!q) return true;
      return (
        booking.id.toLowerCase().includes(q) ||
        booking.customerName.toLowerCase().includes(q) ||
        booking.movieTitle.toLowerCase().includes(q) ||
        booking.showtime.toLowerCase().includes(q)
      );
    });
  }, [bookings, searchQuery, statusFilter]);

  useEffect(() => {
    if (ticketsToPrint && ticketsToPrint.tickets.length > 0) {
      setTimeout(() => {
        downloadElementAsPDF(`printable-batch-${ticketsToPrint.bookingId}`, `tickets-${ticketsToPrint.bookingId}.pdf`).then(() => {
          setTicketsToPrint(null);
        });
      }, 500);
    }
  }, [ticketsToPrint]);

  const handleCheckIn = async (bookingId: string) => {
    try {
      setIsProcessing(prev => ({ ...prev, [bookingId]: true }));
      if (bookingId.startsWith('TK-')) {
        await staffService.scanTicket(bookingId);
      } else {
        const orderId = Number(bookingId.replace('#BK-', ''));
        if (!isNaN(orderId)) {
          const tickets = await bookingService.getOrderTickets(orderId);
          for (const t of tickets) {
            if (t.status !== 'CHECKED_IN' && t.status !== 'CANCELLED' && t.status !== 'REFUNDED') {
              await staffService.scanTicket(t.ticketCode);
            }
          }
        }
      }
      await reload();
      addToast(t('staffTicketLookup.checkInSuccess', 'Check-in completed.'), 'success');
    } catch (e) {
      console.error(e);
      addToast(t('staffTicketLookup.errorCheckIn', 'Không thể Check-in booking này.'), 'error');
    } finally {
      setIsProcessing(prev => ({ ...prev, [bookingId]: false }));
    }
  };

  const handlePrintPDF = async (bookingId: string) => {
    try {
      setIsProcessing(prev => ({ ...prev, [bookingId]: true }));
      let rawTickets: any[] = [];
      if (bookingId.startsWith('TK-')) {
        const singleTicket = await bookingService.getTicketByCode(bookingId);
        if (singleTicket) {
          rawTickets = [singleTicket];
        }
      } else {
        const orderId = Number(bookingId.replace('#BK-', ''));
        if (!isNaN(orderId)) {
          rawTickets = await bookingService.getOrderTickets(orderId);
        }
      }

      const mappedTickets: TicketDetails[] = rawTickets.map(raw => {
        const dt = raw.startTime ? new Date(raw.startTime) : null;
        return {
          ticketCode: raw.ticketCode,
          orderId: raw.orderId,
          movieTitle: raw.displayTitle || raw.movieName || raw.eventTitle || '',
          cinemaName: raw.cinemaName || '',
          hallName: raw.roomName || '',
          showtime: raw.startTime || '',
          date: dt ? dt.toLocaleDateString('vi-VN') : '',
          time: dt ? dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '',
          seats: raw.seatLabel ? [raw.seatLabel] : (raw.seats || []),
          seatLabel: raw.seatLabel,
          seatTypeName: raw.seatTypeName,
          qrCodeData: raw.qrCodeData,
          price: Number(raw.price || 0),
          status: raw.status,
          posterUrl: '',
        };
      });

      setTicketsToPrint({ tickets: mappedTickets, bookingId });
    } catch (e) {
      console.error(e);
      addToast(t('staffTicketLookup.errorLoadTicket', 'Không thể tải vé để in.'), 'error');
    } finally {
      setIsProcessing(prev => ({ ...prev, [bookingId]: false }));
    }
  };

  return (
    <StaffLayout activeItemId="validation">
      <section className="mb-6 sm:mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
        <div>
          <span className="text-[0.65rem] uppercase tracking-[0.15em] font-bold text-on-surface-variant mb-1 block">
            {t('staffTicketLookup.operationalDashboard', 'Operational Dashboard')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">{t('staffTicketLookup.title', 'Ticket Validation')}</h2>
          <p className="text-on-surface-variant mt-2 text-sm max-w-xl">
            {t('staffTicketLookup.subtitle', 'Search, filter and manually validate attendee bookings for the current showtime window.')}
          </p>
        </div>
      </section>

      {isLoading ? (
        <div className="text-center py-12 text-on-surface-variant">{t('staffTicketLookup.loading', 'Loading validation data...')}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-surface-container-lowest p-4 sm:p-6 rounded-xl border border-outline-variant/30 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 sm:mb-4">{t('staffTicketLookup.totalValidated', 'Total Validated')}</p>
              <div className="flex items-end gap-3">
                <span className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tighter">
                  {stats?.totalValidated}
                </span>
                <span className="text-success text-xs font-bold mb-1">+12%</span>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-4 sm:p-6 rounded-xl border border-outline-variant/30 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 sm:mb-4">{t('staffTicketLookup.pendingCheckIn', 'Pending Check-in')}</p>
              <div className="flex items-end gap-3">
                <span className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tighter">
                  {stats?.pendingCheckIns}
                </span>
                <span className="text-on-surface-variant text-xs font-medium mb-1">{t('staffTicketLookup.ofTotal', { count: stats?.totalBookings || 0, defaultValue: 'of {{count}} total' })}</span>
              </div>
            </div>
            <div className="bg-surface-container-low p-4 sm:p-6 rounded-xl border-none">
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2 sm:mb-4">{t('staffTicketLookup.systemStatus', 'System Status')}</p>
              <div className="flex items-center gap-3">
                <span className="flex h-3 w-3 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
                </span>
                <span className="text-base sm:text-lg font-bold text-primary">{t('staffTicketLookup.validatorsOnline', 'Validators Online')}</span>
              </div>
              <p className="text-xs text-on-surface-variant mt-2">{t('staffTicketLookup.scannersOperational', { count: stats?.validatorsOnline || 0, defaultValue: 'All {{count}} gateway scanners operational' })}</p>
            </div>
          </div>

          {/* Search & Status Filter Bar */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-3 sm:p-4 mb-4 sm:mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 flex items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container px-3 min-h-[44px]">
              <Search className="w-4 h-4 text-on-surface-variant shrink-0" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('staffTicketLookup.searchPlaceholder', 'Search Booking ID, ticket code, customer, or movie...')}
                className="w-full bg-transparent outline-none text-base sm:text-sm text-on-surface"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'all', label: t('common.all', 'All') },
                  { id: 'pending', label: t('staffTicketLookup.filterPending', 'Pending') },
                  { id: 'validated', label: t('staffTicketLookup.filterValidated', 'Validated') },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Cards (< md) */}
          <div className="md:hidden space-y-3">
            {filteredBookings.length === 0 ? (
              <div className="bg-surface-container-lowest rounded-xl p-8 text-center text-sm text-on-surface-variant border border-outline-variant/30">
                {t('staffTicketLookup.noMatches', 'No matching bookings found.')}
              </div>
            ) : (
              filteredBookings.map((booking) => (
                <article
                  key={`mobile-${booking.id}`}
                  className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-primary">{booking.id}</p>
                      <h3 className="font-bold text-sm text-on-surface truncate">{booking.customerName}</h3>
                    </div>
                    <span
                      className={`px-2 py-1 text-[10px] font-bold uppercase rounded shrink-0 whitespace-nowrap ${
                        booking.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-success-container text-on-success-container'
                      }`}
                    >
                      {booking.status}
                    </span>
                  </div>
                  <div className="text-xs text-on-surface-variant space-y-1">
                    <p className="font-medium text-on-surface">{booking.movieTitle}</p>
                    <p>{booking.showtime}</p>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-outline-variant/20">
                    <button
                      onClick={() => handleCheckIn(booking.id)}
                      disabled={isProcessing[booking.id] || booking.status !== 'pending'}
                      className="flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-primary text-on-primary font-semibold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      {isProcessing[booking.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      <span>{t('staffTicketLookup.checkInAction', 'Check-in')}</span>
                    </button>
                    <button
                      onClick={() => handlePrintPDF(booking.id)}
                      disabled={isProcessing[booking.id]}
                      className="flex-1 min-h-[44px] px-3 py-2 rounded-lg border border-outline-variant/50 text-on-surface font-semibold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      {isProcessing[booking.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                      <span>{t('staffTicketLookup.printPdfAction', 'Print PDF')}</span>
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          {/* Desktop / Tablet Table (>= md) */}
          <div className="hidden md:block bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant/30">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container/50 border-b border-outline-variant/30">
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-wider text-on-surface-variant">{t('staffTicketLookup.colId', 'Booking ID')}</th>
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-wider text-on-surface-variant">{t('staffTicketLookup.colCustomer', 'Customer Name')}</th>
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-wider text-on-surface-variant">{t('staffTicketLookup.colMovie', 'Movie')}</th>
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-wider text-on-surface-variant">{t('staffTicketLookup.colShowtime', 'Showtime')}</th>
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-wider text-on-surface-variant">{t('staffTicketLookup.colStatus', 'Status')}</th>
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-wider text-on-surface-variant text-right">{t('staffTicketLookup.colActions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-surface-container/50 transition-colors group">
                      <td className="px-6 py-4 font-mono text-sm text-on-surface-variant">{booking.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs shrink-0">
                            {booking.customerName
                              .split(' ')
                              .map((part) => part[0])
                              .join('')}
                          </div>
                          <span className="text-sm font-semibold text-on-surface">{booking.customerName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">{booking.movieTitle}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">{booking.showtime}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-[10px] font-bold uppercase rounded whitespace-nowrap ${booking.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-success-container text-on-success-container'
                            }`}
                        >
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleCheckIn(booking.id)}
                            disabled={isProcessing[booking.id] || booking.status !== 'pending'}
                            className="min-w-[44px] min-h-[44px] px-3 py-2 flex items-center justify-center hover:bg-surface-container-lowest rounded-lg border border-outline-variant/30 text-primary disabled:opacity-50"
                            title="Check-in"
                          >
                            {isProcessing[booking.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handlePrintPDF(booking.id)}
                            disabled={isProcessing[booking.id]}
                            className="min-w-[44px] min-h-[44px] px-3 py-2 flex items-center justify-center hover:bg-surface-container-lowest rounded-lg border border-outline-variant/30 text-on-surface-variant disabled:opacity-50"
                            title="Print PDF"
                          >
                            {isProcessing[booking.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Hidden element for printing */}
      {ticketsToPrint && ticketsToPrint.tickets.length > 0 && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
          <div id={`printable-batch-${ticketsToPrint.bookingId}`} className="flex flex-col gap-4 bg-surface-container p-8">
            {ticketsToPrint.tickets.map(ticket => (
              <PrintableTicket key={ticket.ticketCode} ticket={ticket} />
            ))}
          </div>
        </div>
      )}
    </StaffLayout>
  );
};
