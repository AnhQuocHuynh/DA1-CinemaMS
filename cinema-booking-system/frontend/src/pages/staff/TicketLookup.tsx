import React, { useState, useEffect } from 'react';
import { CheckCircle, FileText, Loader2 } from 'lucide-react';
import { StaffLayout } from '../../components/staff/StaffLayout';
import { useStaffValidation } from '../../hooks/useStaffValidation';
import { bookingService } from '../../services/bookingService';
import { staffService } from '../../services/staffService';
import { PrintableTicket } from '../../components/PrintableTicket';
import { downloadElementAsPDF } from '../../utils/pdfGenerator';
import { TicketDetails } from '../../types/booking';

export const TicketLookup: React.FC = () => {
  const { stats, bookings, isLoading, reload } = useStaffValidation();
  const [ticketsToPrint, setTicketsToPrint] = useState<{ tickets: TicketDetails[], bookingId: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});

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
      const orderId = Number(bookingId.replace('#BK-', ''));
      const tickets = await bookingService.getOrderTickets(orderId);
      for (const t of tickets) {
        if (t.status !== 'CHECKED_IN' && t.status !== 'CANCELLED' && t.status !== 'REFUNDED') {
          await staffService.scanTicket(t.ticketCode);
        }
      }
      await reload();
    } catch (e) {
      console.error(e);
      alert('Không thể Check-in booking này.');
    } finally {
      setIsProcessing(prev => ({ ...prev, [bookingId]: false }));
    }
  };

  const handlePrintPDF = async (bookingId: string) => {
    try {
      setIsProcessing(prev => ({ ...prev, [bookingId]: true }));
      const orderId = Number(bookingId.replace('#BK-', ''));
      const rawTickets = await bookingService.getOrderTickets(orderId);

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
          seats: raw.seatLabel ? [raw.seatLabel] : [],
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
      alert('Không thể tải vé để in.');
    } finally {
      setIsProcessing(prev => ({ ...prev, [bookingId]: false }));
    }
  };

  return (
    <StaffLayout activeItemId="validation" searchPlaceholder="Search Booking ID or Customer...">
      <section className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-[0.65rem] uppercase tracking-[0.15em] font-bold text-on-surface-variant mb-1 block">
            Operational Dashboard
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface">Ticket Validation</h2>
          <p className="text-on-surface-variant mt-2 text-sm max-w-xl">
            Search, filter and manually validate attendee bookings for the current showtime window.
          </p>
        </div>
      </section>

      {isLoading ? (
        <div className="text-center py-12 text-on-surface-variant">Loading validation data...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Total Validated</p>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-extrabold text-on-surface tracking-tighter">
                  {stats?.totalValidated}
                </span>
                <span className="text-success text-xs font-bold mb-1">+12%</span>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Pending Check-in</p>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-extrabold text-on-surface tracking-tighter">
                  {stats?.pendingCheckIns}
                </span>
                <span className="text-on-surface-variant text-xs font-medium mb-1">of {stats?.totalBookings} total</span>
              </div>
            </div>
            <div className="bg-surface-container-low p-6 rounded-xl border-none">
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-4">System Status</p>
              <div className="flex items-center gap-3">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
                </span>
                <span className="text-lg font-bold text-primary">Validators Online</span>
              </div>
              <p className="text-xs text-on-surface-variant mt-2">All {stats?.validatorsOnline} gateway scanners operational</p>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant/30">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container/50 border-b border-outline-variant/30">
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-wider text-on-surface-variant">Booking ID</th>
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-wider text-on-surface-variant">Customer Name</th>
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-wider text-on-surface-variant">Movie</th>
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-wider text-on-surface-variant">Showtime</th>
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-wider text-on-surface-variant text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-surface-container/50 transition-colors group">
                      <td className="px-6 py-4 font-mono text-sm text-on-surface-variant">{booking.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-primary font-bold text-xs">
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
                          className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${booking.status === 'pending'
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
                            className="p-2 hover:bg-surface-container-lowest rounded border border-outline-variant/30 text-primary disabled:opacity-50"
                            title="Check-in"
                          >
                            {isProcessing[booking.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handlePrintPDF(booking.id)}
                            disabled={isProcessing[booking.id]}
                            className="p-2 hover:bg-surface-container-lowest rounded border border-outline-variant/30 text-on-surface-variant disabled:opacity-50"
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
