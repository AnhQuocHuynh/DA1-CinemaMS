import React, { useEffect, useState } from 'react';
import { 
  Ticket, 
  AlertCircle, 
  Calendar, 
  Clock, 
  MapPin, 
  RotateCcw, 
  QrCode, 
  CheckCircle2, 
  X,
  CreditCard,
  Film,
  Tv,
  Plus,
  AlertTriangle,
  Loader2,
  Check,
  ShieldAlert
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { bookingService } from '../../services/bookingService';
import { rentalService } from '../../services/rentalService';
import { cinemaService } from '../../services/cinemaService';
import { movieService } from '../../services/movieService';
import { SiteTopNav } from '../../components/SiteTopNav';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../contexts/ToastContext';
import { formatVND, parseVND } from '../../utils/formatters';
import { canCustomerCancelConfirmed } from '../../utils/rentalUtils';
import { useTranslation } from 'react-i18next';
import { BackendOrder } from '../../types/booking';
import { RentalView, RentalStatus } from '../../types/rental';

const STATUS_BADGES: Record<string, { labelKey: string; className: string }> = {
  PAID: { labelKey: 'userDashboard.status.PAID', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' },
  REFUNDED: { labelKey: 'userDashboard.status.REFUNDED', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30' },
  PENDING: { labelKey: 'userDashboard.status.PENDING', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30' },
  CANCELLED: { labelKey: 'userDashboard.status.CANCELLED', className: 'bg-surface-container text-on-surface-variant border border-outline-variant/30' },
};

const RENTAL_STATUS_BADGES: Record<RentalStatus, { labelKey: string; fallback: string; className: string }> = {
  PENDING_APPROVAL: {
    labelKey: 'userDashboard.rentalStatus.PENDING_APPROVAL',
    fallback: 'Pending Approval',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30',
  },
  AWAITING_PAYMENT: {
    labelKey: 'userDashboard.rentalStatus.AWAITING_PAYMENT',
    fallback: 'Awaiting Payment',
    className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30',
  },
  CONFIRMED: {
    labelKey: 'userDashboard.rentalStatus.CONFIRMED',
    fallback: 'Confirmed',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
  },
  REJECTED: {
    labelKey: 'userDashboard.rentalStatus.REJECTED',
    fallback: 'Rejected',
    className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30',
  },
  CANCELLED: {
    labelKey: 'userDashboard.rentalStatus.CANCELLED',
    fallback: 'Cancelled',
    className: 'bg-surface-container text-on-surface-variant border border-outline-variant/30',
  },
  EXPIRED: {
    labelKey: 'userDashboard.rentalStatus.EXPIRED',
    fallback: 'Expired',
    className: 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/30',
  },
};

export const UserDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab State: initialize from ?tab= query parameter
  const activeTab = searchParams.get('tab') === 'rentals' ? 'rentals' : 'tickets';

  const handleTabChange = (tab: 'tickets' | 'rentals') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'rentals') {
        next.set('tab', 'rentals');
      } else {
        next.delete('tab');
      }
      return next;
    });
  };

  // Movie Tickets State
  const [orders, setOrders] = useState<BackendOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refund modal state for Movie Tickets
  const [refundOrder, setRefundOrder] = useState<BackendOrder | null>(null);
  const [refundReason, setRefundReason] = useState<string>('');
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Room Rentals State
  const [rentals, setRentals] = useState<RentalView[]>([]);
  const [isLoadingRentals, setIsLoadingRentals] = useState(false);
  const [rentalError, setRentalError] = useState<string | null>(null);

  // Lookup maps for Cinema names, Room names, and Movie titles
  const [cinemasMap, setCinemasMap] = useState<Record<number, string>>({});
  const [roomsMap, setRoomsMap] = useState<Record<number, { roomName: string; cinemaName: string }>>({});
  const [moviesMap, setMoviesMap] = useState<Record<number, string>>({});

  // Payment modal state for Room Rentals
  const [paymentRental, setPaymentRental] = useState<RentalView | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('VNPAY');
  const [isPayingRental, setIsPayingRental] = useState(false);
  const [paymentRentalError, setPaymentRentalError] = useState<string | null>(null);

  // Cancellation modal state for Room Rentals
  const [cancelTarget, setCancelTarget] = useState<{ rental: RentalView; isConfirmed: boolean } | null>(null);
  const [isCancellingRental, setIsCancellingRental] = useState(false);
  const [cancelRentalError, setCancelRentalError] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    const userId = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10);
    if (isNaN(userId)) {
      setError(t('userDashboard.noUserId'));
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const userOrders = await bookingService.getUserOrders(userId);
      setOrders(userOrders);
    } catch {
      setError(t('userDashboard.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRentalsAndLookups = async () => {
    if (!user?.id) {
      setIsLoadingRentals(false);
      return;
    }

    setRentalError(null);
    setIsLoadingRentals(true);

    try {
      const [rentalList, cinemasWithRooms, movieList] = await Promise.all([
        rentalService.getMyRentals(),
        cinemaService.getCinemasWithRooms().catch(() => []),
        movieService.getMovies().catch(() => []),
      ]);

      setRentals(rentalList);

      // Map cinema IDs to names and room IDs to details
      const cMap: Record<number, string> = {};
      const rMap: Record<number, { roomName: string; cinemaName: string }> = {};

      cinemasWithRooms.forEach((cinema) => {
        cMap[cinema.id] = cinema.name;
        if (Array.isArray(cinema.rooms)) {
          cinema.rooms.forEach((room) => {
            rMap[room.id] = {
              roomName: room.name,
              cinemaName: cinema.name,
            };
          });
        }
      });

      // Map movie IDs to titles
      const mMap: Record<number, string> = {};
      movieList.forEach((movie) => {
        mMap[movie.id] = movie.title;
      });

      setCinemasMap(cMap);
      setRoomsMap(rMap);
      setMoviesMap(mMap);
    } catch (err: unknown) {
      console.error('Failed to load customer rentals:', err);
      setRentalError(t('userDashboard.rentalsLoadError', 'Unable to load room rentals right now.'));
    } finally {
      setIsLoadingRentals(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchRentalsAndLookups();
  }, [user]);

  // Movie Tickets Refund Modal Handlers
  const handleOpenRefundModal = (order: BackendOrder) => {
    setRefundOrder(order);
    setRefundReason(t('userDashboard.modal.defaultReason'));
    setRefundError(null);
  };

  const handleCloseRefundModal = () => {
    if (isRefunding) return;
    setRefundOrder(null);
    setRefundError(null);
  };

  const handleConfirmRefund = async () => {
    if (!refundOrder) return;
    setIsRefunding(true);
    setRefundError(null);

    try {
      await bookingService.refundOrder(refundOrder.id, refundReason || t('userDashboard.modal.defaultReason'));
      const toastMsg = t('userDashboard.modal.successToast', { orderId: refundOrder.id });
      setSuccessToast(toastMsg);
      addToast(toastMsg, 'success');
      setTimeout(() => setSuccessToast(null), 6000);
      handleCloseRefundModal();
      await fetchOrders();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setRefundError(e?.response?.data?.message || t('userDashboard.modal.errorGeneric'));
    } finally {
      setIsRefunding(false);
    }
  };

  // Room Rental Online Payment Handlers
  const handleOpenRentalPaymentModal = (rental: RentalView) => {
    setPaymentRental(rental);
    setSelectedPaymentMethod('VNPAY');
    setPaymentRentalError(null);
  };

  const handleCloseRentalPaymentModal = () => {
    if (isPayingRental) return;
    setPaymentRental(null);
    setPaymentRentalError(null);
  };

  const handleConfirmRentalPayment = async () => {
    if (!paymentRental) return;
    setIsPayingRental(true);
    setPaymentRentalError(null);

    try {
      await rentalService.payOnline(paymentRental.id, selectedPaymentMethod);
      const msg = t('userDashboard.rentalPaidSuccess', 'Payment completed successfully for rental #RN-{{id}}!', {
        id: paymentRental.id,
      });
      setSuccessToast(msg);
      addToast(msg, 'success');
      setTimeout(() => setSuccessToast(null), 6000);
      handleCloseRentalPaymentModal();
      await fetchRentalsAndLookups();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setPaymentRentalError(e?.response?.data?.message || e?.message || t('userDashboard.paymentFailed', 'Payment failed. Please try again.'));
    } finally {
      setIsPayingRental(false);
    }
  };

  // Room Rental Cancellation Handlers
  const handleOpenCancelModal = (rental: RentalView, isConfirmed: boolean) => {
    setCancelTarget({ rental, isConfirmed });
    setCancelRentalError(null);
  };

  const handleCloseCancelModal = () => {
    if (isCancellingRental) return;
    setCancelTarget(null);
    setCancelRentalError(null);
  };

  const handleConfirmRentalCancel = async () => {
    if (!cancelTarget) return;
    setIsCancellingRental(true);
    setCancelRentalError(null);

    try {
      await rentalService.cancel(cancelTarget.rental.id);
      const msg = cancelTarget.isConfirmed
        ? t(
            'userDashboard.rentalCancelRefundSuccess',
            'Rental #RN-{{id}} has been cancelled and a 100% refund has been submitted.',
            { id: cancelTarget.rental.id }
          )
        : t(
            'userDashboard.rentalCancelSuccess',
            'Rental request #RN-{{id}} has been cancelled.',
            { id: cancelTarget.rental.id }
          );

      setSuccessToast(msg);
      addToast(msg, 'success');
      setTimeout(() => setSuccessToast(null), 6000);
      handleCloseCancelModal();
      await fetchRentalsAndLookups();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setCancelRentalError(e?.response?.data?.message || e?.message || t('userDashboard.cancelFailed', 'Failed to cancel rental.'));
    } finally {
      setIsCancellingRental(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <SiteTopNav activeLabel="My Tickets" showSearch={false} />

      <main className="pt-24 px-4 sm:px-8 pb-16">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Header */}
          <section className="border-b border-outline-variant/20 pb-6">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
              {t('userDashboard.title')}
            </h1>
            <p className="text-on-surface-variant text-sm sm:text-base mt-2">
              {t('userDashboard.subtitle')}
            </p>
          </section>

          {/* Segmented Tab Bar & CTA */}
          <section className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/30 pb-3">
            <div className="flex items-center gap-2 p-1 bg-surface-container rounded-xl">
              <button
                type="button"
                onClick={() => handleTabChange('tickets')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'tickets'
                    ? 'bg-surface-container-lowest text-primary shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Ticket className="w-4 h-4" />
                <span>{t('userDashboard.movieTicketsTab', 'Movie Tickets')}</span>
                {orders.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-primary/10 text-primary">
                    {orders.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('rentals')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'rentals'
                    ? 'bg-surface-container-lowest text-primary shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Tv className="w-4 h-4" />
                <span>{t('userDashboard.roomRentalsTab', 'Room Rentals')}</span>
                {rentals.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-primary/10 text-primary">
                    {rentals.length}
                  </span>
                )}
              </button>
            </div>

            {/* Book a Room CTA Link */}
            {activeTab === 'rentals' && (
              <Link
                to="/room-rental"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:opacity-95 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                {t('userDashboard.bookRoomBtn', 'Book a Room')}
              </Link>
            )}
          </section>

          {/* Success Toast Banner */}
          {successToast && (
            <div className="flex items-center gap-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 p-4 rounded-xl shadow-sm animate-fade-in">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p className="text-sm font-semibold">{successToast}</p>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: MOVIE TICKETS                                                      */}
          {/* ========================================================================= */}
          {activeTab === 'tickets' && (
            <>
              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-3 bg-error/10 text-error border border-error/30 rounded-xl p-4">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              {/* Content Loading */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-on-surface-variant text-sm font-medium animate-pulse">
                    {t('userDashboard.loading')}
                  </p>
                </div>
              ) : orders.length > 0 ? (
                <div className="space-y-6">
                  {orders.map((order) => {
                    const statusMeta = STATUS_BADGES[order.status] || {
                      labelKey: '',
                      className: 'bg-surface-container text-on-surface-variant border border-outline-variant/30',
                    };

                    const dateString = order.startTime ? new Date(order.startTime).toLocaleDateString(
                      i18n.language === 'vi' ? 'vi-VN' : 'en-US',
                      { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }
                    ) : '';

                    const timeString = order.startTime ? new Date(order.startTime).toLocaleTimeString(
                      i18n.language === 'vi' ? 'vi-VN' : 'en-US',
                      { hour: '2-digit', minute: '2-digit' }
                    ) : '';

                    const numericAmount = parseVND(order.finalAmount);
                    const refundPercent = order.refundPercent ?? 0;
                    const refundableAmount = (numericAmount * refundPercent) / 100;

                    return (
                      <div
                        key={order.id}
                        className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-sm hover:shadow-md transition-all overflow-hidden"
                      >
                        {/* Order Card Top Bar */}
                        <div className="bg-surface-container-low/70 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/20">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs font-bold text-on-surface-variant px-2.5 py-1 bg-surface-container rounded-md">
                              #{order.id}
                            </span>
                            <span className="text-xs text-on-surface-variant">
                              {t('userDashboard.bookedOn')}{' '}
                              {new Date(order.createdAt).toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusMeta.className}`}>
                              {statusMeta.labelKey ? t(statusMeta.labelKey, order.status) : order.status}
                            </span>
                          </div>
                        </div>

                        {/* Order Card Body */}
                        <div className="p-6 space-y-5">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Film className="w-5 h-5 text-primary shrink-0" />
                                <h2 className="text-lg font-bold text-on-surface tracking-tight">
                                  {(order.displayTitle || order.movieTitle || t('userDashboard.movieTicket')).toUpperCase()}
                                </h2>
                              </div>

                              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs sm:text-sm text-on-surface-variant">
                                {order.cinemaName && (
                                  <span className="flex items-center gap-1.5 font-medium">
                                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                                    {order.cinemaName} {order.roomName ? `• ${order.roomName}` : ''}
                                  </span>
                                )}
                                {order.startTime && (
                                  <span className="flex items-center gap-1.5 font-medium">
                                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                                    {dateString}
                                    <Clock className="w-4 h-4 text-primary shrink-0 ml-1.5" />
                                    {timeString}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Amount & Method */}
                            <div className="text-left md:text-right shrink-0">
                              <p className="text-xs text-on-surface-variant font-medium">{t('userDashboard.totalPayment')}</p>
                              <p className="text-xl font-extrabold text-primary">
                                {formatVND(numericAmount)}
                              </p>
                              {order.paymentMethod && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant mt-0.5">
                                  <CreditCard className="w-3 h-3" />
                                  {order.paymentMethod}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Grouped Tickets/Seats section */}
                          <div className="bg-surface-container-low/50 rounded-xl p-4 border border-outline-variant/30 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                                <Ticket className="w-4 h-4 text-primary" />
                                {t('userDashboard.ticketsInOrder', { count: order.tickets?.length || order.seatLabels?.length || 0 })}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                              {(order.tickets && order.tickets.length > 0) ? (
                                order.tickets.map((t_ticket) => (
                                  <div
                                    key={t_ticket.ticketCode}
                                    className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-2.5 flex items-center justify-between gap-2 shadow-2xs hover:border-primary/50 transition-colors"
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-primary">
                                          {t('userDashboard.seat', { seat: t_ticket.seatLabel || 'N/A' })}
                                        </span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                          t_ticket.status === 'VALID' 
                                            ? 'bg-emerald-500/10 text-emerald-600' 
                                            : t_ticket.status === 'REFUNDED'
                                            ? 'bg-rose-500/10 text-rose-600'
                                            : 'bg-surface-container text-on-surface-variant'
                                        }`}>
                                          {t(`userDashboard.status.${t_ticket.status}`, t_ticket.status)}
                                        </span>
                                      </div>
                                      <p className="font-mono text-[11px] text-on-surface-variant truncate">
                                        {t_ticket.ticketCode}
                                      </p>
                                    </div>
                                    <Link
                                      to={`/user/tickets/${t_ticket.ticketCode}`}
                                      className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-on-primary transition-colors shrink-0"
                                      title={t('userDashboard.viewQrCode')}
                                    >
                                      <QrCode className="w-4 h-4" />
                                    </Link>
                                  </div>
                                ))
                              ) : (
                                order.seatLabels?.map((seatLabel) => (
                                  <div
                                    key={seatLabel}
                                    className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-2.5 text-xs font-bold text-primary shadow-2xs"
                                  >
                                    {t('userDashboard.seat', { seat: seatLabel })}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Card Footer / Refund Action */}
                          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/20">
                            <div>
                              {order.status === 'PAID' && order.refundable && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md">
                                  ✓ {t('userDashboard.refundSupport', { percent: order.refundPercent, amount: formatVND(refundableAmount) })}
                                </span>
                              )}
                              {order.status === 'PAID' && !order.refundable && (
                                <span className="text-xs text-on-surface-variant italic">
                                  {t('userDashboard.refundExpired')}
                                </span>
                              )}
                              {order.status === 'REFUNDED' && (
                                <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                                  {t('userDashboard.refundCompleted')}
                                </span>
                              )}
                            </div>

                            {order.status === 'PAID' && order.refundable && (
                              <button
                                onClick={() => handleOpenRefundModal(order)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-error/10 hover:bg-error/20 text-error rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                {t('userDashboard.refundOrderBtn')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-surface-container-lowest rounded-2xl p-12 text-center border border-outline-variant/30 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
                    <Ticket className="w-8 h-8 opacity-60" />
                  </div>
                  <h2 className="text-lg font-bold text-on-surface">
                    {t('userDashboard.noTickets')}
                  </h2>
                  <p className="text-sm text-on-surface-variant max-w-sm mx-auto">
                    {t('userDashboard.startBooking')}
                  </p>
                  <div className="pt-2">
                    <Link
                      to="/"
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-xl font-semibold text-sm hover:opacity-95 shadow-sm transition-all"
                    >
                      {t('userDashboard.findMovie')}
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: ROOM RENTALS                                                       */}
          {/* ========================================================================= */}
          {activeTab === 'rentals' && (
            <>
              {/* Error Message */}
              {rentalError && (
                <div className="flex items-center gap-3 bg-error/10 text-error border border-error/30 rounded-xl p-4">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-sm font-medium">{rentalError}</p>
                </div>
              )}

              {/* Content Loading */}
              {isLoadingRentals ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-on-surface-variant text-sm font-medium animate-pulse">
                    {t('userDashboard.loadingRentals', 'Loading room rentals...')}
                  </p>
                </div>
              ) : rentals.length > 0 ? (
                <div className="space-y-6">
                  {rentals.map((rental) => {
                    const statusMeta = RENTAL_STATUS_BADGES[rental.status] || {
                      labelKey: '',
                      fallback: rental.status,
                      className: 'bg-surface-container text-on-surface-variant border border-outline-variant/30',
                    };

                    const cinemaName = cinemasMap[rental.cinemaId] || roomsMap[rental.roomId]?.cinemaName || t('userDashboard.cinema', 'Cinema');
                    const roomName = roomsMap[rental.roomId]?.roomName || `${t('userDashboard.room', 'Room')} #${rental.roomId}`;
                    const movieTitle = rental.movieId ? (moviesMap[rental.movieId] || `Movie #${rental.movieId}`) : null;

                    const dateString = rental.startTime ? dayjs(rental.startTime).format('ddd, DD/MM/YYYY') : '';
                    const timeWindowString = rental.startTime && rental.endTime
                      ? `${dayjs(rental.startTime).format('HH:mm')} – ${dayjs(rental.endTime).format('HH:mm')}`
                      : '';

                    const isCancelableConfirmed = rental.status === 'CONFIRMED' && canCustomerCancelConfirmed(rental.startTime);

                    return (
                      <div
                        key={rental.id}
                        className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-sm hover:shadow-md transition-all overflow-hidden"
                      >
                        {/* Rental Card Top Bar */}
                        <div className="bg-surface-container-low/70 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/20">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs font-bold text-primary px-2.5 py-1 bg-primary/10 rounded-md">
                              #RN-{rental.id}
                            </span>
                            <span className="text-xs text-on-surface-variant flex items-center gap-1.5 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                              {cinemaName} • <span className="font-bold text-on-surface">{roomName}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Rental Status Badge */}
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusMeta.className}`}>
                              {t(statusMeta.labelKey, statusMeta.fallback)}
                            </span>

                            {/* Refund Status Badge */}
                            {rental.refundStatus !== 'NONE' && (
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  rental.refundStatus === 'COMPLETED'
                                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                }`}
                              >
                                {rental.refundStatus === 'COMPLETED'
                                  ? `${t('userDashboard.refunded', 'Refunded')}: ${formatVND(rental.refundAmount || 0)}`
                                  : t('userDashboard.refundPending', 'Refund Pending')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Rental Card Body */}
                        <div className="p-6 space-y-5">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="space-y-2.5">
                              {/* Event / Movie Info */}
                              <div className="flex items-center gap-2">
                                <Tv className="w-5 h-5 text-primary shrink-0" />
                                <h2 className="text-lg font-bold text-on-surface tracking-tight">
                                  {movieTitle
                                    ? `${t('userDashboard.privateScreeningOf', 'Private Screening')}: ${movieTitle}`
                                    : t('userDashboard.privateHallBooking', 'Private Hall Booking / Event')}
                                </h2>
                              </div>

                              {/* Date & Time Window */}
                              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs sm:text-sm text-on-surface-variant">
                                <span className="flex items-center gap-1.5 font-medium">
                                  <Calendar className="w-4 h-4 text-primary shrink-0" />
                                  {dateString}
                                </span>
                                <span className="flex items-center gap-1.5 font-medium">
                                  <Clock className="w-4 h-4 text-primary shrink-0" />
                                  {timeWindowString}
                                </span>
                              </div>
                            </div>

                            {/* Rate & Total Payment */}
                            <div className="text-left md:text-right shrink-0">
                              <p className="text-xs text-on-surface-variant font-medium">
                                {t('userDashboard.hourlyRate', 'Hourly Rate')}:{' '}
                                <span className="font-semibold text-on-surface">{formatVND(rental.pricePerHour)}/hr</span>
                              </p>
                              <p className="text-xl font-extrabold text-primary mt-0.5">
                                {formatVND(rental.totalAmount)}
                              </p>
                              {rental.paymentMethod && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant mt-0.5">
                                  <CreditCard className="w-3 h-3" />
                                  {rental.paymentMethod}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Expiration Notice for PENDING_APPROVAL and AWAITING_PAYMENT */}
                          {rental.expiresAt && (rental.status === 'PENDING_APPROVAL' || rental.status === 'AWAITING_PAYMENT') && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl text-xs flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                                <span>
                                  {rental.status === 'PENDING_APPROVAL'
                                    ? t('userDashboard.approvalWindowNotice', 'Staff approval window expires at {{time}} ({{date}}).', {
                                        time: dayjs(rental.expiresAt).format('HH:mm'),
                                        date: dayjs(rental.expiresAt).format('DD/MM/YYYY'),
                                      })
                                    : t('userDashboard.paymentWindowNotice', 'Payment window expires at {{time}} ({{date}}). Please complete payment to secure your booking.', {
                                        time: dayjs(rental.expiresAt).format('HH:mm'),
                                        date: dayjs(rental.expiresAt).format('DD/MM/YYYY'),
                                      })}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Rejection Reason Notice */}
                          {rental.status === 'REJECTED' && rental.decisionReason && (
                            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-start gap-2.5">
                              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                              <div>
                                <span className="font-bold">
                                  {t('userDashboard.rejectionReasonTitle', 'Rejection Reason')}:
                                </span>{' '}
                                <span>{rental.decisionReason}</span>
                              </div>
                            </div>
                          )}

                          {/* Card Footer Actions */}
                          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/20">
                            <div>
                              {rental.status === 'AWAITING_PAYMENT' && (
                                <span className="text-[11px] text-on-surface-variant italic">
                                  * {t('userDashboard.counterCashNotice', 'You may also pay with Cash directly at the cinema box office.')}
                                </span>
                              )}
                              {rental.status === 'CONFIRMED' && !isCancelableConfirmed && (
                                <span className="text-xs text-on-surface-variant italic">
                                  {t('userDashboard.cancellationWindowClosed', 'Online cancellation closes 24 hours before start time.')}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {/* AWAITING_PAYMENT: Pay Online Button */}
                              {rental.status === 'AWAITING_PAYMENT' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRentalPaymentModal(rental)}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:opacity-90 shadow-xs transition-all cursor-pointer"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  {t('userDashboard.payOnlineBtn', 'Pay Online')}
                                </button>
                              )}

                              {/* PENDING_APPROVAL or AWAITING_PAYMENT: Cancel Request Button */}
                              {(rental.status === 'PENDING_APPROVAL' || rental.status === 'AWAITING_PAYMENT') && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCancelModal(rental, false)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-error/10 hover:bg-error/20 text-error rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  {t('userDashboard.cancelRequestBtn', 'Cancel Request')}
                                </button>
                              )}

                              {/* CONFIRMED: Cancel & 100% Refund Button */}
                              {rental.status === 'CONFIRMED' && isCancelableConfirmed && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCancelModal(rental, true)}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-error/10 hover:bg-error/20 text-error rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  {t('userDashboard.cancelAndRefundBtn', 'Cancel & Request 100% Refund')}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-surface-container-lowest rounded-2xl p-12 text-center border border-outline-variant/30 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
                    <Tv className="w-8 h-8 opacity-60" />
                  </div>
                  <h2 className="text-lg font-bold text-on-surface">
                    {t('userDashboard.noRentals', 'No Room Rentals Yet')}
                  </h2>
                  <p className="text-sm text-on-surface-variant max-w-sm mx-auto">
                    {t(
                      'userDashboard.startRentalBooking',
                      'Looking to host a private screening, presentation, or gaming tournament? Book a private auditorium today!'
                    )}
                  </p>
                  <div className="pt-2">
                    <Link
                      to="/room-rental"
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-xl font-semibold text-sm hover:opacity-95 shadow-sm transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      {t('userDashboard.bookRoomCta', 'Book a Screening Room')}
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </main>

      {/* ========================================================================= */}
      {/* MODAL 1: MOVIE TICKETS REFUND CONFIRMATION                                 */}
      {/* ========================================================================= */}
      {refundOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2 text-error font-bold text-lg">
                <RotateCcw className="w-5 h-5" />
                {t('userDashboard.modal.confirmTitle', { orderId: refundOrder.id })}
              </div>
              <button
                onClick={handleCloseRefundModal}
                disabled={isRefunding}
                className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="bg-surface-container-low rounded-xl p-4 space-y-2">
                <p className="font-bold text-on-surface text-base">
                  {(refundOrder.displayTitle || refundOrder.movieTitle || t('userDashboard.movieTicket')).toUpperCase()}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {refundOrder.cinemaName} • {refundOrder.roomName}
                </p>
                <p className="text-xs text-on-surface-variant font-medium">
                  {t('userDashboard.modal.refundSeats')}{' '}
                  <span className="text-primary font-bold">{refundOrder.seatLabels?.join(', ')}</span>{' '}
                  {t('userDashboard.modal.ticketsCount', { count: refundOrder.seatLabels?.length || refundOrder.tickets?.length || 0 })}
                </p>
              </div>

              {/* Refund calculation breakdown */}
              <div className="border border-outline-variant/30 rounded-xl p-4 space-y-2 bg-surface-container-lowest">
                <div className="flex justify-between text-xs text-on-surface-variant">
                  <span>{t('userDashboard.modal.totalPaid')}</span>
                  <span className="font-bold text-on-surface">{formatVND(parseVND(refundOrder.finalAmount))}</span>
                </div>
                <div className="flex justify-between text-xs text-on-surface-variant">
                  <span>{t('userDashboard.modal.refundRate')}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {refundOrder.refundPercent}% {refundOrder.refundPercent === 100 ? t('userDashboard.modal.rateOver24h') : t('userDashboard.modal.rate4To24h')}
                  </span>
                </div>
                <div className="border-t border-outline-variant/20 pt-2 flex justify-between font-bold text-sm">
                  <span>{t('userDashboard.modal.refundAmount')}</span>
                  <span className="text-primary text-base">
                    {formatVND((parseVND(refundOrder.finalAmount) * (refundOrder.refundPercent || 0)) / 100)}
                  </span>
                </div>
              </div>

              <div className="bg-error/10 border border-error/20 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-error">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  <strong>{i18n.language === 'vi' ? 'Lưu ý:' : 'Note:'}</strong>{' '}
                  {t('userDashboard.modal.notice', { count: refundOrder.seatLabels?.length || refundOrder.tickets?.length || 0 })}
                </p>
              </div>

              {/* Reason input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">
                  {t('userDashboard.modal.reasonLabel')}
                </label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder={t('userDashboard.modal.reasonPlaceholder')}
                  disabled={isRefunding}
                  className="w-full px-3 py-2 text-xs bg-surface border border-outline-variant/40 rounded-lg focus:outline-none focus:border-primary text-on-surface"
                />
              </div>

              {refundError && (
                <div className="bg-error/15 text-error p-3 rounded-lg text-xs font-medium border border-error/30">
                  {refundError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCloseRefundModal}
                disabled={isRefunding}
                className="px-4 py-2 border border-outline-variant/40 rounded-xl text-xs font-semibold hover:bg-surface-container transition-colors"
              >
                {t('userDashboard.modal.keepTicket')}
              </button>
              <button
                type="button"
                onClick={handleConfirmRefund}
                disabled={isRefunding}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-error text-white rounded-xl text-xs font-bold hover:bg-error/90 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {isRefunding ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('userDashboard.modal.processing')}
                  </>
                ) : (
                  t('userDashboard.modal.confirmBtn')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ROOM RENTAL ONLINE PAYMENT MODAL                                  */}
      {/* ========================================================================= */}
      {paymentRental && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2 text-on-surface font-bold text-lg">
                <CreditCard className="w-5 h-5 text-primary" />
                {t('userDashboard.payRentalTitle', 'Pay for Room Rental #RN-{{id}}', { id: paymentRental.id })}
              </div>
              <button
                onClick={handleCloseRentalPaymentModal}
                disabled={isPayingRental}
                className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-surface-container-low rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-on-surface-variant">
                  <span>{t('userDashboard.totalAmountDue', 'Total Amount Due')}</span>
                  <span className="text-base font-black text-primary">{formatVND(paymentRental.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant text-[11px]">
                  <span>{t('userDashboard.paymentWindowExpires', 'Expires at')}</span>
                  <span className="font-mono text-on-surface">
                    {paymentRental.expiresAt ? dayjs(paymentRental.expiresAt).format('HH:mm (DD/MM/YYYY)') : '—'}
                  </span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  {t('userDashboard.selectPaymentMethod', 'Select Payment Method')}
                </label>

                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'VNPAY', label: 'VNPay QR / Domestic Card', desc: 'Scan QR code with banking app or use ATM card' },
                    { id: 'STRIPE', label: 'Credit / Debit Card (Stripe)', desc: 'Visa, Mastercard, JCB, American Express' },
                    { id: 'PAYPAL', label: 'PayPal', desc: 'Pay with PayPal balance or international card' },
                  ].map((method) => {
                    const isSelected = selectedPaymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setSelectedPaymentMethod(method.id)}
                        className={`p-3 rounded-xl border text-left flex items-start justify-between gap-2 transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-outline-variant/30 hover:border-primary/40 bg-surface-container-lowest'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-xs text-on-surface">{method.label}</p>
                          <p className="text-[10px] text-on-surface-variant mt-0.5">{method.desc}</p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-surface-container rounded-xl text-[11px] text-on-surface-variant">
                <p className="flex items-center gap-1.5 font-semibold text-on-surface">
                  <ShieldAlert className="w-3.5 h-3.5 text-primary shrink-0" />
                  {t('userDashboard.counterPaymentOption', 'Counter Cash Payment Option')}
                </p>
                <p className="mt-1 text-[10px]">
                  {t(
                    'userDashboard.counterPaymentNote',
                    'You may also complete payment by CASH at the cinema box office within the 15-minute payment window.'
                  )}
                </p>
              </div>

              {paymentRentalError && (
                <div className="bg-error/15 text-error p-3 rounded-lg text-xs font-medium border border-error/30">
                  {paymentRentalError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCloseRentalPaymentModal}
                disabled={isPayingRental}
                className="px-4 py-2 border border-outline-variant/40 rounded-xl text-xs font-semibold hover:bg-surface-container transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmRentalPayment}
                disabled={isPayingRental}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:opacity-90 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {isPayingRental ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {t('userDashboard.processingPayment', 'Processing...')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {t('userDashboard.confirmPaymentBtn', 'Confirm & Pay')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ROOM RENTAL CANCELLATION CONFIRMATION                            */}
      {/* ========================================================================= */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2 text-error font-bold text-lg">
                <AlertTriangle className="w-5 h-5 text-error" />
                {cancelTarget.isConfirmed
                  ? t('userDashboard.confirmCancelRentalRefundTitle', 'Cancel Rental & Request 100% Refund')
                  : t('userDashboard.confirmCancelRentalTitle', 'Cancel Rental Request')}
              </div>
              <button
                onClick={handleCloseCancelModal}
                disabled={isCancellingRental}
                className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-surface-container-low rounded-xl p-4 space-y-2">
                <p className="font-bold text-on-surface text-sm">
                  {t('userDashboard.rentalLabel', 'Room Rental')} #RN-{cancelTarget.rental.id}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {cinemasMap[cancelTarget.rental.cinemaId] || roomsMap[cancelTarget.rental.roomId]?.cinemaName} •{' '}
                  {roomsMap[cancelTarget.rental.roomId]?.roomName || `Room #${cancelTarget.rental.roomId}`}
                </p>
                <p className="text-xs font-semibold text-primary">
                  {formatVND(cancelTarget.rental.totalAmount)}
                </p>
              </div>

              {cancelTarget.isConfirmed ? (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs space-y-1">
                  <p className="font-bold">
                    ✓ {t('userDashboard.eligibleFor100Refund', 'Eligible for 100% Refund')}
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    {t(
                      'userDashboard.confirmedRefundPolicyDesc',
                      'Because this cancellation is made at least 24 hours prior to the reservation start time, you are entitled to a full 100% refund of {{amount}}.',
                      { amount: formatVND(cancelTarget.rental.totalAmount) }
                    )}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl text-xs">
                  <p className="font-semibold">
                    {t('userDashboard.cancelRequestNotice', 'Are you sure you want to cancel this room rental request? This action cannot be undone.')}
                  </p>
                </div>
              )}

              {cancelRentalError && (
                <div className="bg-error/15 text-error p-3 rounded-lg text-xs font-medium border border-error/30">
                  {cancelRentalError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCloseCancelModal}
                disabled={isCancellingRental}
                className="px-4 py-2 border border-outline-variant/40 rounded-xl text-xs font-semibold hover:bg-surface-container transition-colors"
              >
                {t('userDashboard.keepRental', 'Keep Rental')}
              </button>
              <button
                type="button"
                onClick={handleConfirmRentalCancel}
                disabled={isCancellingRental}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-error text-white rounded-xl text-xs font-bold hover:bg-error/90 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {isCancellingRental ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {t('userDashboard.cancelling', 'Cancelling...')}
                  </>
                ) : (
                  t('userDashboard.confirmCancelBtn', 'Confirm Cancellation')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default UserDashboard;
