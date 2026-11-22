import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  Building2,
  DollarSign,
  Clock,
  RotateCcw,
  DoorOpen,
  Film,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  CreditCard,
  Ban,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  RentalView,
  RentalReport,
  RentalSearchParams,
  RentalStatus,
} from '../../types/rental';
import { rentalService } from '../../services/rentalService';
import {
  cinemaService,
  CinemaWithRoomsResponse,
  CinemaRoomResponse,
} from '../../services/cinemaService';
import { movieService, MovieResponse } from '../../services/movieService';
import { canStaffCancelConfirmed } from '../../utils/rentalUtils';
import { formatVND } from '../../utils/formatters';
import { useToast } from '../../contexts/ToastContext';
import { useAuthStore } from '../../store/authStore';
import { userService } from '../../services/userService';

export interface RentalManagementViewProps {
  mode: 'ADMIN' | 'STAFF';
}

function formatSchedule(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return '—';
  const start = dayjs(startTime);
  const end = dayjs(endTime);
  if (!start.isValid() || !end.isValid()) return `${startTime} – ${endTime}`;

  const isSameDay = start.isSame(end, 'day');
  if (isSameDay) {
    return `${start.format('DD/MM/YYYY HH:mm')} – ${end.format('HH:mm')}`;
  }
  return `${start.format('DD/MM/YYYY HH:mm')} – ${end.format('DD/MM/YYYY HH:mm')}`;
}

export const RentalManagementView: React.FC<RentalManagementViewProps> = ({ mode }) => {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { user } = useAuthStore();

  // Reference metadata
  const [cinemas, setCinemas] = useState<CinemaWithRoomsResponse[]>([]);
  const [movies, setMovies] = useState<MovieResponse[]>([]);

  // Core data
  const [rentals, setRentals] = useState<RentalView[]>([]);
  const [report, setReport] = useState<RentalReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Staff cinema state
  const [staffCinemaId, setStaffCinemaId] = useState<number | null>(() =>
    user?.cinemaId ? Number(user.cinemaId) : null
  );

  // Filters
  const [selectedCinemaId, setSelectedCinemaId] = useState<string>('ALL');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Row-level action loading state
  const [rowActionLoading, setRowActionLoading] = useState<Record<number, boolean>>({});

  // Reject modal state
  const [rejectingRental, setRejectingRental] = useState<RentalView | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  // Confirm modal state (replaces blocking window.confirm)
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    tone?: 'primary' | 'danger' | 'amber';
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [isConfirmBusy, setIsConfirmBusy] = useState(false);

  // Lookup dictionaries
  const cinemaMap = useMemo<Record<number, CinemaWithRoomsResponse>>(() => {
    const map: Record<number, CinemaWithRoomsResponse> = {};
    for (const c of cinemas) {
      map[c.id] = c;
    }
    return map;
  }, [cinemas]);

  const allRooms = useMemo<CinemaRoomResponse[]>(() => {
    return cinemas.flatMap((c) => c.rooms || []);
  }, [cinemas]);

  const roomMap = useMemo<Record<number, CinemaRoomResponse>>(() => {
    const map: Record<number, CinemaRoomResponse> = {};
    for (const r of allRooms) {
      map[r.id] = r;
    }
    return map;
  }, [allRooms]);

  const movieMap = useMemo<Record<number, MovieResponse>>(() => {
    const map: Record<number, MovieResponse> = {};
    for (const m of movies) {
      map[m.id] = m;
    }
    return map;
  }, [movies]);

  useEffect(() => {
    if (mode !== 'STAFF') return;
    userService
      .getMyProfile()
      .then((profile) => {
        if (profile?.cinemaId) {
          setStaffCinemaId(Number(profile.cinemaId));
        }
      })
      .catch((err) => {
        console.warn('Failed to load staff profile for cinema scope', err);
      });
  }, [mode]);

  const effectiveStaffCinemaId = useMemo(() => {
    if (staffCinemaId) return staffCinemaId;
    const fromRental = rentals.find((r) => r.cinemaId)?.cinemaId;
    return fromRental ?? null;
  }, [staffCinemaId, rentals]);

  const staffCinemaName = useMemo(() => {
    if (!effectiveStaffCinemaId) {
      return t('rentalManagement.unassignedBranch', 'Unassigned Branch');
    }
    const cinema = cinemaMap[effectiveStaffCinemaId];
    return cinema?.name || t('rentalManagement.cinemaIdLabel', 'Cinema #{{id}}', { id: effectiveStaffCinemaId });
  }, [effectiveStaffCinemaId, cinemaMap, t]);

  const filteredRooms = useMemo<CinemaRoomResponse[]>(() => {
    const activeCinemaFilter =
      mode === 'STAFF'
        ? effectiveStaffCinemaId
        : selectedCinemaId === 'ALL'
        ? null
        : Number(selectedCinemaId);

    if (!activeCinemaFilter) {
      return allRooms;
    }
    return allRooms.filter((r) => r.cinemaId === activeCinemaFilter);
  }, [allRooms, selectedCinemaId, mode, effectiveStaffCinemaId]);

  // Initial load of cinemas & movies
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      cinemaService.getCinemasWithRooms().catch(() => []),
      movieService.getMovies().catch(() => []),
    ]).then(([cinemasData, moviesData]) => {
      if (isMounted) {
        setCinemas(cinemasData || []);
        setMovies(moviesData || []);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch rentals and report
  const loadData = useCallback(async () => {
    setIsLoading(true);
    const params: RentalSearchParams = {};
    if (selectedCinemaId !== 'ALL' && selectedCinemaId !== '') {
      params.cinemaId = Number(selectedCinemaId);
    }
    if (selectedRoomId !== 'ALL' && selectedRoomId !== '') {
      params.roomId = Number(selectedRoomId);
    }
    if (selectedStatus !== 'ALL' && selectedStatus !== '') {
      params.status = selectedStatus as RentalStatus;
    }
    if (fromDate) {
      params.from = `${fromDate}T00:00:00`;
    }
    if (toDate) {
      params.to = `${toDate}T23:59:59`;
    }

    const reportFrom = fromDate ? `${fromDate}T00:00:00` : undefined;
    const reportTo = toDate ? `${toDate}T23:59:59` : undefined;

    try {
      const rentalsData = await rentalService.search(params);
      setRentals(rentalsData || []);
    } catch (err) {
      console.error('Failed to load rentals list', err);
      addToast(t('rentalManagement.loadRentalsError', 'Failed to load rental list'), 'error');
    }

    try {
      const reportData = await rentalService.getReport(reportFrom, reportTo);
      setReport(reportData);
    } catch (err) {
      console.warn('Failed to load rental revenue report', err);
      // Non-blocking for table
    } finally {
      setIsLoading(false);
    }
  }, [selectedCinemaId, selectedRoomId, selectedStatus, fromDate, toDate, addToast, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResetFilters = () => {
    setSelectedCinemaId('ALL');
    setSelectedRoomId('ALL');
    setSelectedStatus('ALL');
    setFromDate('');
    setToDate('');
  };

  const setRowLoading = (id: number, loading: boolean) => {
    setRowActionLoading((prev) => ({ ...prev, [id]: loading }));
  };

  // Row Actions
  const handleApprove = async (rental: RentalView) => {
    setRowLoading(rental.id, true);
    try {
      await rentalService.approve(rental.id);
      addToast(
        t('rentalManagement.approveSuccess', 'Rental #RN-{{id}} approved successfully.', { id: rental.id }),
        'success'
      );
      await loadData();
    } catch (err: any) {
      console.error('Failed to approve rental', err);
      addToast(err?.response?.data?.message || t('rentalManagement.approveError', 'Failed to approve rental.'), 'error');
    } finally {
      setRowLoading(rental.id, false);
    }
  };

  const handleOpenReject = (rental: RentalView) => {
    setRejectingRental(rental);
    setRejectReason('');
    setRejectError(null);
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingRental) return;

    const trimmed = rejectReason.trim();
    if (!trimmed) {
      setRejectError(t('rentalManagement.reasonRequired', 'Please enter a rejection reason.'));
      return;
    }

    setIsRejecting(true);
    setRejectError(null);
    try {
      await rentalService.reject(rejectingRental.id, trimmed);
      addToast(
        t('rentalManagement.rejectSuccess', 'Rental #RN-{{id}} was rejected.', { id: rejectingRental.id }),
        'success'
      );
      setRejectingRental(null);
      await loadData();
    } catch (err: any) {
      console.error('Failed to reject rental', err);
      setRejectError(err?.response?.data?.message || t('rentalManagement.rejectError', 'Failed to reject rental.'));
    } finally {
      setIsRejecting(false);
    }
  };

  const handleConfirmCashPayment = (rental: RentalView) => {
    setConfirmModal({
      title: t('rentalManagement.confirmCash', 'Confirm Counter Cash'),
      message: t('rentalManagement.confirmCashPrompt', 'Confirm receipt of cash payment for Rental #RN-{{id}} ({{amount}})?', {
        id: rental.id,
        amount: formatVND(rental.totalAmount),
      }),
      confirmLabel: t('rentalManagement.confirmCash', 'Confirm Counter Cash'),
      tone: 'primary',
      onConfirm: async () => {
        setRowLoading(rental.id, true);
        try {
          await rentalService.pay(rental.id, 'CASH');
          addToast(
            t('rentalManagement.paySuccess', 'Cash payment confirmed for Rental #RN-{{id}}.', { id: rental.id }),
            'success'
          );
          await loadData();
        } catch (err: any) {
          console.error('Failed to process cash payment', err);
          addToast(err?.response?.data?.message || t('rentalManagement.payError', 'Failed to process cash payment.'), 'error');
        } finally {
          setRowLoading(rental.id, false);
        }
      },
    });
  };

  const handleCancelAwaiting = (rental: RentalView) => {
    setConfirmModal({
      title: t('rentalManagement.cancel', 'Cancel'),
      message: t('rentalManagement.confirmCancelAwaiting', 'Are you sure you want to cancel Rental #RN-{{id}}?', {
        id: rental.id,
      }),
      confirmLabel: t('rentalManagement.cancel', 'Cancel'),
      tone: 'danger',
      onConfirm: async () => {
        setRowLoading(rental.id, true);
        try {
          await rentalService.cancel(rental.id);
          addToast(
            t('rentalManagement.cancelSuccess', 'Rental #RN-{{id}} has been cancelled.', { id: rental.id }),
            'success'
          );
          await loadData();
        } catch (err: any) {
          console.error('Failed to cancel rental', err);
          addToast(err?.response?.data?.message || t('rentalManagement.cancelError', 'Failed to cancel rental.'), 'error');
        } finally {
          setRowLoading(rental.id, false);
        }
      },
    });
  };

  const handleCancelConfirmed = (rental: RentalView) => {
    setConfirmModal({
      title: t('rentalManagement.cancelIssueRefund', 'Cancel (Issue Refund)'),
      message: t(
        'rentalManagement.confirmCancelConfirmed',
        'Are you sure you want to cancel confirmed Rental #RN-{{id}}? This will cancel the booking and initiate a refund request.',
        { id: rental.id }
      ),
      confirmLabel: t('rentalManagement.cancelIssueRefund', 'Cancel (Issue Refund)'),
      tone: 'amber',
      onConfirm: async () => {
        setRowLoading(rental.id, true);
        try {
          await rentalService.cancel(rental.id);
          addToast(
            t('rentalManagement.cancelRefundSuccess', 'Rental #RN-{{id}} cancelled. Refund is now pending.', {
              id: rental.id,
            }),
            'success'
          );
          await loadData();
        } catch (err: any) {
          console.error('Failed to cancel confirmed rental', err);
          addToast(err?.response?.data?.message || t('rentalManagement.cancelError', 'Failed to cancel rental.'), 'error');
        } finally {
          setRowLoading(rental.id, false);
        }
      },
    });
  };

  const handleCompleteRefund = (rental: RentalView) => {
    const refundAmount = rental.refundAmount ?? rental.totalAmount;
    setConfirmModal({
      title: t('rentalManagement.completeRefund', 'Complete Refund'),
      message: t('rentalManagement.confirmCompleteRefund', 'Mark refund as completed for Rental #RN-{{id}} ({{amount}})?', {
        id: rental.id,
        amount: formatVND(refundAmount),
      }),
      confirmLabel: t('rentalManagement.completeRefund', 'Complete Refund'),
      tone: 'primary',
      onConfirm: async () => {
        setRowLoading(rental.id, true);
        try {
          await rentalService.completeRefund(rental.id);
          addToast(
            t('rentalManagement.refundCompletedSuccess', 'Refund completed for Rental #RN-{{id}}.', { id: rental.id }),
            'success'
          );
          await loadData();
        } catch (err: any) {
          console.error('Failed to complete refund', err);
          addToast(err?.response?.data?.message || t('rentalManagement.refundError', 'Failed to complete refund.'), 'error');
        } finally {
          setRowLoading(rental.id, false);
        }
      },
    });
  };

  // Status Badge Renderer
  const renderStatusBadge = (rental: RentalView) => {
    let badgeClass = 'bg-surface-container text-on-surface-variant border-outline-variant';
    let label: string = rental.status;

    switch (rental.status) {
      case 'PENDING_APPROVAL':
        badgeClass = 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
        label = t('rentalStatus.pendingApproval', 'Pending Approval');
        break;
      case 'AWAITING_PAYMENT':
        badgeClass = 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30';
        label = t('rentalStatus.awaitingPayment', 'Awaiting Payment');
        break;
      case 'CONFIRMED':
        badgeClass = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
        label = t('rentalStatus.confirmed', 'Confirmed');
        break;
      case 'REJECTED':
        badgeClass = 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30';
        label = t('rentalStatus.rejected', 'Rejected');
        break;
      case 'CANCELLED':
        badgeClass = 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/30';
        label = t('rentalStatus.cancelled', 'Cancelled');
        break;
      case 'EXPIRED':
        badgeClass = 'bg-stone-500/10 text-stone-700 dark:text-stone-300 border-stone-500/30';
        label = t('rentalStatus.expired', 'Expired');
        break;
    }

    return (
      <div className="flex flex-col gap-1 items-start">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${badgeClass}`}
        >
          {label}
        </span>
        {rental.refundStatus !== 'NONE' && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
              rental.refundStatus === 'PENDING'
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
            }`}
          >
            {rental.refundStatus === 'PENDING'
              ? t('rentalStatus.refundPending', 'Refund Pending')
              : t('rentalStatus.refundCompleted', 'Refunded')}
            {rental.refundAmount != null && rental.refundAmount > 0 && ` (${formatVND(rental.refundAmount)})`}
          </span>
        )}
        {rental.decisionReason && (
          <p
            className="text-[11px] text-on-surface-variant italic truncate max-w-xs"
            title={rental.decisionReason}
          >
            {rental.decisionReason}
          </p>
        )}
        {rental.status === 'AWAITING_PAYMENT' && rental.expiresAt && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-mono">
            <Clock className="w-2.5 h-2.5" />
            {t('rentalStatus.expires', 'Expires: {{time}}', {
              time: dayjs(rental.expiresAt).format('DD/MM HH:mm'),
            })}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPI & Revenue Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Requests */}
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/30 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
              {t('rentalManagement.kpiTotalRequests', 'Total Rental Requests')}
            </span>
            <span className="text-3xl font-extrabold text-on-surface tracking-tight">
              {report?.rentalCount ?? rentals.length}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Confirmed Revenue */}
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/30 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
              {t('rentalManagement.kpiConfirmedRevenue', 'Confirmed Revenue')}
            </span>
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {formatVND(report?.confirmedRevenue ?? 0)}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Pending Approvals */}
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/30 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
              {t('rentalManagement.kpiPendingApprovals', 'Pending Approvals')}
            </span>
            <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
              {rentals.filter((r) => r.status === 'PENDING_APPROVAL').length}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Pending Refunds */}
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/30 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
              {t('rentalManagement.kpiPendingRefunds', 'Pending Refunds')}
            </span>
            <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">
              {rentals.filter((r) => r.refundStatus === 'PENDING').length}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <RotateCcw className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Optional Compact Revenue Breakdown Strip */}
      {report && report.byRoom && report.byRoom.length > 0 && (
        <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
              <DoorOpen className="w-3.5 h-3.5 text-primary" />
              {t('rentalManagement.revenueByRoomTitle', 'Revenue Breakdown by Room')}
            </span>
            <span className="text-[11px] text-on-surface-variant">
              {t('rentalManagement.roomsActive', '{{count}} rooms active', { count: report.byRoom.length })}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {report.byRoom.map((b) => {
              const roomName = roomMap[Number(b.key)]?.name || `${t('rentalManagement.room', 'Room')} #${b.key}`;
              const cinemaId = roomMap[Number(b.key)]?.cinemaId;
              const cinemaName = cinemaId ? cinemaMap[cinemaId]?.name : undefined;

              return (
                <div
                  key={b.key}
                  className="p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/20 flex flex-col justify-between"
                >
                  <div className="truncate">
                    <p className="font-semibold text-xs text-on-surface truncate" title={roomName}>
                      {roomName}
                    </p>
                    {cinemaName && (
                      <p className="text-[10px] text-on-surface-variant truncate" title={cinemaName}>
                        {cinemaName}
                      </p>
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-outline-variant/10 flex flex-wrap items-center justify-between gap-1 text-xs">
                    <span className="text-[10px] text-on-surface-variant">
                      {b.count} {t('rentalManagement.bookings', 'bookings')}
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatVND(b.confirmedRevenue)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Cinema Dropdown for Admin, subtle badge for Staff */}
          {mode === 'ADMIN' ? (
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                {t('rentalManagement.filterCinema', 'Cinema')}
              </label>
              <select
                value={selectedCinemaId}
                onChange={(e) => {
                  setSelectedCinemaId(e.target.value);
                  setSelectedRoomId('ALL');
                }}
                className="w-full min-h-[40px] px-3 py-2 bg-surface-container-low border border-outline-variant/40 rounded-lg text-base sm:text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="ALL">{t('rentalManagement.allCinemas', 'All Cinemas')}</option>
                {cinemas.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center min-w-[180px]">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                {t('rentalManagement.venueScope', 'Venue Scope')}
              </label>
              <div
                className="flex items-center gap-1.5 min-h-[40px] px-3 py-2 bg-primary/10 rounded-lg border border-primary/20 text-xs font-semibold text-primary"
                title={staffCinemaName}
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{staffCinemaName}</span>
              </div>
            </div>
          )}

          {/* Room Dropdown */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">
              {t('rentalManagement.filterRoom', 'Room')}
            </label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 bg-surface-container-low border border-outline-variant/40 rounded-lg text-base sm:text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="ALL">{t('rentalManagement.allRooms', 'All Rooms')}</option>
              {filteredRooms.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.name} {selectedCinemaId === 'ALL' && cinemaMap[r.cinemaId]?.name ? `(${cinemaMap[r.cinemaId].name})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">
              {t('rentalManagement.filterStatus', 'Status')}
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 bg-surface-container-low border border-outline-variant/40 rounded-lg text-base sm:text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="ALL">{t('rentalManagement.statusAll', 'All Statuses')}</option>
              <option value="PENDING_APPROVAL">{t('rentalStatus.pendingApproval', 'Pending Approval')}</option>
              <option value="AWAITING_PAYMENT">{t('rentalStatus.awaitingPayment', 'Awaiting Payment')}</option>
              <option value="CONFIRMED">{t('rentalStatus.confirmed', 'Confirmed')}</option>
              <option value="CANCELLED">{t('rentalStatus.cancelled', 'Cancelled')}</option>
              <option value="REJECTED">{t('rentalStatus.rejected', 'Rejected')}</option>
              <option value="EXPIRED">{t('rentalStatus.expired', 'Expired')}</option>
            </select>
          </div>

          {/* From Date */}
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">
              {t('rentalManagement.filterFromDate', 'From Date')}
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full min-h-[40px] px-3 py-1.5 bg-surface-container-low border border-outline-variant/40 rounded-lg text-base sm:text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* To Date */}
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">
              {t('rentalManagement.filterToDate', 'To Date')}
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full min-h-[40px] px-3 py-1.5 bg-surface-container-low border border-outline-variant/40 rounded-lg text-base sm:text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Reset & Refresh */}
          <div className="flex items-end gap-2 pt-0 sm:pt-5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex-1 sm:flex-none min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors"
              title={t('rentalManagement.resetFilters', 'Reset filters')}
            >
              {t('rentalManagement.reset', 'Reset')}
            </button>
            <button
              type="button"
              onClick={() => loadData()}
              disabled={isLoading}
              className="flex-1 sm:flex-none min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-semibold bg-primary text-on-primary hover:brightness-110 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              title={t('rentalManagement.refresh', 'Refresh list')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{t('rentalManagement.refresh', 'Refresh')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Rentals Cards (< md) */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-8 text-center text-on-surface-variant">
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
            <span className="text-xs">{t('rentalManagement.loadingRentals', 'Loading room rentals...')}</span>
          </div>
        ) : rentals.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-8 text-center text-on-surface-variant">
            <p className="text-sm font-medium">{t('rentalManagement.emptyState', 'No room rentals found matching current filters.')}</p>
            <p className="text-xs text-on-surface-variant/70 mt-1">
              {t('rentalManagement.emptyStateHint', 'Try adjusting your date range or filter criteria.')}
            </p>
          </div>
        ) : (
          rentals.map((rental) => {
            const cinema = cinemaMap[rental.cinemaId];
            const room = roomMap[rental.roomId];
            const movie = rental.movieId ? movieMap[rental.movieId] : null;
            const isActionBusy = Boolean(rowActionLoading[rental.id]);
            const canCancelConfirmed = canStaffCancelConfirmed(rental.startTime);

            return (
              <article
                key={`mobile-rental-${rental.id}`}
                className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-4 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-bold text-sm text-on-surface">#RN-{rental.id}</p>
                    <p className="text-xs text-on-surface-variant">{t('rentalManagement.user', 'User')} #{rental.userId}</p>
                  </div>
                  {renderStatusBadge(rental)}
                </div>

                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-on-surface">
                    {cinema?.name || `${t('rentalManagement.cinema', 'Cinema')} #${rental.cinemaId}`} •{' '}
                    {room?.name || `${t('rentalManagement.room', 'Room')} #${rental.roomId}`}
                  </p>
                  <p className="text-on-surface-variant">{formatSchedule(rental.startTime, rental.endTime)}</p>
                  {rental.movieId && (
                    <p className="text-primary font-medium truncate">
                      {movie?.title || `${t('rentalManagement.movie', 'Movie')} #${rental.movieId}`}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 text-xs">
                  <span className="font-bold text-sm text-on-surface">{formatVND(rental.totalAmount)}</span>
                  <span className="text-on-surface-variant">{formatVND(rental.pricePerHour)}/hr</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {rental.status === 'PENDING_APPROVAL' && (
                    <>
                      <button
                        type="button"
                        disabled={isActionBusy}
                        onClick={() => handleApprove(rental)}
                        className="flex-1 min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t('rentalManagement.approve', 'Approve')}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isActionBusy}
                        onClick={() => handleOpenReject(rental)}
                        className="flex-1 min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold bg-rose-600/10 text-rose-600 border border-rose-500/30 flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{t('rentalManagement.reject', 'Reject')}</span>
                      </button>
                    </>
                  )}
                  {rental.status === 'AWAITING_PAYMENT' && (
                    <>
                      <button
                        type="button"
                        disabled={isActionBusy}
                        onClick={() => handleConfirmCashPayment(rental)}
                        className="flex-1 min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold bg-primary text-on-primary flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>{t('rentalManagement.confirmCash', 'Confirm Counter Cash')}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isActionBusy}
                        onClick={() => handleCancelAwaiting(rental)}
                        className="min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 border border-rose-500/20 disabled:opacity-50"
                      >
                        {t('rentalManagement.cancel', 'Cancel')}
                      </button>
                    </>
                  )}
                  {rental.status === 'CONFIRMED' && canCancelConfirmed && (
                    <button
                      type="button"
                      disabled={isActionBusy}
                      onClick={() => handleCancelConfirmed(rental)}
                      className="w-full min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold bg-amber-600/10 text-amber-700 border border-amber-500/30 flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>{t('rentalManagement.cancelIssueRefund', 'Cancel (Issue Refund)')}</span>
                    </button>
                  )}
                  {rental.status === 'CANCELLED' && rental.refundStatus === 'PENDING' && (
                    <button
                      type="button"
                      disabled={isActionBusy}
                      onClick={() => handleCompleteRefund(rental)}
                      className="w-full min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('rentalManagement.completeRefund', 'Complete Refund')}</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Actionable Rentals Table (>= md) */}
      <div className="hidden md:block bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container/50 border-b border-outline-variant/30 text-[0.7rem] font-bold uppercase tracking-wider text-on-surface-variant">
                <th className="px-6 py-4">{t('rentalManagement.colRentalId', 'Rental ID')}</th>
                <th className="px-6 py-4">{t('rentalManagement.colVenue', 'Venue')}</th>
                <th className="px-6 py-4">{t('rentalManagement.colSchedule', 'Schedule')}</th>
                <th className="px-6 py-4">{t('rentalManagement.colFinancials', 'Financials')}</th>
                <th className="px-6 py-4">{t('rentalManagement.colStatus', 'Status')}</th>
                <th className="px-6 py-4 text-right">{t('rentalManagement.colActions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-xs">{t('rentalManagement.loadingRentals', 'Loading room rentals...')}</span>
                    </div>
                  </td>
                </tr>
              ) : rentals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                    <p className="text-sm font-medium">{t('rentalManagement.emptyState', 'No room rentals found matching current filters.')}</p>
                    <p className="text-xs text-on-surface-variant/70 mt-1">
                      {t('rentalManagement.emptyStateHint', 'Try adjusting your date range or filter criteria.')}
                    </p>
                  </td>
                </tr>
              ) : (
                rentals.map((rental) => {
                  const cinema = cinemaMap[rental.cinemaId];
                  const room = roomMap[rental.roomId];
                  const movie = rental.movieId ? movieMap[rental.movieId] : null;
                  const isActionBusy = Boolean(rowActionLoading[rental.id]);
                  const canCancelConfirmed = canStaffCancelConfirmed(rental.startTime);

                  return (
                    <tr
                      key={rental.id}
                      className="hover:bg-surface-container/40 transition-colors"
                    >
                      {/* Column 1: Rental ID */}
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-on-surface text-sm">
                          #RN-{rental.id}
                        </div>
                        <div className="text-xs text-on-surface-variant mt-0.5">
                          {t('rentalManagement.user', 'User')} #{rental.userId}
                        </div>
                      </td>

                      {/* Column 2: Venue */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-on-surface text-sm">
                          {cinema?.name || `${t('rentalManagement.cinema', 'Cinema')} #${rental.cinemaId}`}
                        </div>
                        <div className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
                          <DoorOpen className="w-3 h-3 text-outline" />
                          <span>{room?.name || `${t('rentalManagement.room', 'Room')} #${rental.roomId}`}</span>
                        </div>
                      </td>

                      {/* Column 3: Schedule */}
                      <td className="px-6 py-4">
                        <div className="text-xs font-medium text-on-surface">
                          {formatSchedule(rental.startTime, rental.endTime)}
                        </div>
                        {rental.movieId && (
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-primary font-medium">
                            <Film className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[200px]" title={movie?.title}>
                              {movie?.title || `${t('rentalManagement.movie', 'Movie')} #${rental.movieId}`}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Column 4: Financials */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-on-surface text-sm">
                          {formatVND(rental.totalAmount)}
                        </div>
                        <div className="text-xs text-on-surface-variant mt-0.5">
                          {formatVND(rental.pricePerHour)}/hr
                        </div>
                        {rental.paymentMethod && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-surface-container text-on-surface-variant border border-outline-variant/30 uppercase">
                            {rental.paymentMethod}
                          </span>
                        )}
                      </td>

                      {/* Column 5: Status */}
                      <td className="px-6 py-4">
                        {renderStatusBadge(rental)}
                      </td>

                      {/* Column 6: Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {/* PENDING_APPROVAL: Approve & Reject */}
                          {rental.status === 'PENDING_APPROVAL' && (
                            <>
                              <button
                                type="button"
                                disabled={isActionBusy}
                                onClick={() => handleApprove(rental)}
                                className="min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1 disabled:opacity-50"
                              >
                                {isActionBusy ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3" />
                                )}
                                <span>{t('rentalManagement.approve', 'Approve')}</span>
                              </button>
                              <button
                                type="button"
                                disabled={isActionBusy}
                                onClick={() => handleOpenReject(rental)}
                                className="min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-colors flex items-center gap-1 disabled:opacity-50"
                              >
                                <XCircle className="w-3 h-3" />
                                <span>{t('rentalManagement.reject', 'Reject')}</span>
                              </button>
                            </>
                          )}

                          {/* AWAITING_PAYMENT: Confirm Counter Cash & Cancel */}
                          {rental.status === 'AWAITING_PAYMENT' && (
                            <>
                              <button
                                type="button"
                                disabled={isActionBusy}
                                onClick={() => handleConfirmCashPayment(rental)}
                                className="min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold bg-primary text-on-primary hover:brightness-110 transition-all flex items-center gap-1 disabled:opacity-50"
                              >
                                {isActionBusy ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CreditCard className="w-3 h-3" />
                                )}
                                <span>{t('rentalManagement.confirmCash', 'Confirm Counter Cash')}</span>
                              </button>
                              <button
                                type="button"
                                disabled={isActionBusy}
                                onClick={() => handleCancelAwaiting(rental)}
                                className="min-h-[40px] px-3 py-2 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                              >
                                <span>{t('rentalManagement.cancel', 'Cancel')}</span>
                              </button>
                            </>
                          )}

                          {/* CONFIRMED: Cancel (Issue Refund) when canStaffCancelConfirmed is true */}
                          {rental.status === 'CONFIRMED' && (
                            <>
                              {canCancelConfirmed ? (
                                <button
                                  type="button"
                                  disabled={isActionBusy}
                                  onClick={() => handleCancelConfirmed(rental)}
                                  className="min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold bg-amber-600/10 hover:bg-amber-600/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 transition-colors flex items-center gap-1 disabled:opacity-50"
                                >
                                  {isActionBusy ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Ban className="w-3 h-3" />
                                  )}
                                  <span>{t('rentalManagement.cancelIssueRefund', 'Cancel (Issue Refund)')}</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-on-surface-variant italic">
                                  {t('rentalManagement.startedOrPast', 'Show started / completed')}
                                </span>
                              )}
                            </>
                          )}

                          {/* CANCELLED && refundStatus === 'PENDING': Complete Refund */}
                          {rental.status === 'CANCELLED' && rental.refundStatus === 'PENDING' && (
                            <button
                              type="button"
                              disabled={isActionBusy}
                              onClick={() => handleCompleteRefund(rental)}
                              className="min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1 disabled:opacity-50"
                            >
                              {isActionBusy ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3 h-3" />
                              )}
                              <span>{t('rentalManagement.completeRefund', 'Complete Refund')}</span>
                            </button>
                          )}

                          {/* Empty fallback for static states */}
                          {rental.status !== 'PENDING_APPROVAL' &&
                            rental.status !== 'AWAITING_PAYMENT' &&
                            !(rental.status === 'CONFIRMED' && canCancelConfirmed) &&
                            !(rental.status === 'CANCELLED' && rental.refundStatus === 'PENDING') && (
                              <span className="text-xs text-on-surface-variant/60">—</span>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rejection Modal */}
      {rejectingRental && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto shadow-2xl animate-scale-up">
            <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-surface-container flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-base sm:text-lg text-on-surface flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                  <span className="truncate">{t('rentalManagement.rejectModalTitle', 'Reject Rental Request')}</span>
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {t('rentalManagement.rejectModalSubtitle', 'Rental #RN-{{id}} • User #{{userId}}', {
                    id: rejectingRental.id,
                    userId: rejectingRental.userId,
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectingRental(null)}
                className="min-w-[40px] min-h-[40px] -mr-2 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="p-5 sm:p-6 space-y-4">
              {rejectError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
                  {rejectError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                  {t('rentalManagement.rejectionReasonLabel', 'Rejection Reason *')}
                </label>
                <textarea
                  rows={4}
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t(
                    'rentalManagement.rejectReasonPlaceholder',
                    'Please specify a clear reason for the customer (e.g. equipment maintenance, scheduling conflict, private screening unavailability)...'
                  )}
                  className="w-full px-3.5 py-2.5 bg-surface-container-low border border-outline-variant/40 rounded-lg text-on-surface text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setRejectingRental(null)}
                  className="min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isRejecting || !rejectReason.trim()}
                  className="min-h-[40px] px-5 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isRejecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{t('rentalManagement.confirmRejectBtn', 'Reject Request')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-base sm:text-lg text-on-surface">{confirmModal.title}</h3>
              <button
                type="button"
                disabled={isConfirmBusy}
                onClick={() => setConfirmModal(null)}
                className="min-w-[40px] min-h-[40px] -mr-2 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">{confirmModal.message}</p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isConfirmBusy}
                onClick={() => setConfirmModal(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-outline-variant/40 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={isConfirmBusy}
                onClick={async () => {
                  setIsConfirmBusy(true);
                  try {
                    await confirmModal.onConfirm();
                    setConfirmModal(null);
                  } finally {
                    setIsConfirmBusy(false);
                  }
                }}
                className={`min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                  confirmModal.tone === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : confirmModal.tone === 'amber'
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-primary hover:brightness-110'
                }`}
              >
                {isConfirmBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{confirmModal.confirmLabel}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
