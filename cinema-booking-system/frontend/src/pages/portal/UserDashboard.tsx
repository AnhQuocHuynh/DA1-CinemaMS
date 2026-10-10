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
  Film
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { bookingService } from '../../services/bookingService';
import { SiteTopNav } from '../../components/SiteTopNav';
import { useAuthStore } from '../../store/authStore';
import { formatVND, parseVND } from '../../utils/formatters';
import { useTranslation } from 'react-i18next';
import { BackendOrder } from '../../types/booking';

const STATUS_BADGES: Record<string, { labelKey: string; className: string }> = {
  PAID: { labelKey: 'userDashboard.status.PAID', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' },
  REFUNDED: { labelKey: 'userDashboard.status.REFUNDED', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30' },
  PENDING: { labelKey: 'userDashboard.status.PENDING', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30' },
  CANCELLED: { labelKey: 'userDashboard.status.CANCELLED', className: 'bg-surface-container text-on-surface-variant border border-outline-variant/30' },
};

export const UserDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<BackendOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refund modal state
  const [refundOrder, setRefundOrder] = useState<BackendOrder | null>(null);
  const [refundReason, setRefundReason] = useState<string>('');
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

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

  useEffect(() => {
    fetchOrders();
  }, [user]);

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
      setSuccessToast(t('userDashboard.modal.successToast', { orderId: refundOrder.id }));
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

          {/* Success Toast */}
          {successToast && (
            <div className="flex items-center gap-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 p-4 rounded-xl shadow-sm animate-fade-in">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p className="text-sm font-semibold">{successToast}</p>
            </div>
          )}

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
        </div>
      </main>

      {/* Refund Confirmation Modal */}
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
    </div>
  );
};

