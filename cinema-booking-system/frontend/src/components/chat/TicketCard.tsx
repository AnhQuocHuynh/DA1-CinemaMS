import { Link } from 'react-router-dom';
import { Armchair, Calendar, DoorOpen, MapPin, Receipt, Ticket } from 'lucide-react';
import { useCinebotTranslation } from './useCinebotTranslation';
import type { ParsedTicket } from './types';

interface TicketCardProps {
  ticket: ParsedTicket;
}

function getStatusClasses(status?: string): string {
  const normalized = status?.toUpperCase() || '';
  if (normalized === 'CONFIRMED' || normalized === 'PAID' || normalized === 'COMPLETED') {
    return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  }
  if (normalized === 'PENDING' || normalized === 'AWAITING_PAYMENT') {
    return 'border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300';
  }
  if (
    normalized === 'CANCELLED' ||
    normalized === 'CANCELED' ||
    normalized === 'EXPIRED' ||
    normalized === 'FAILED'
  ) {
    return 'border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300';
  }
  if (normalized === 'REFUNDED') {
    return 'border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300';
  }
  return 'border-outline-variant bg-surface-container-high text-on-surface-variant';
}

export function TicketCard({ ticket }: TicketCardProps) {
  const { t } = useCinebotTranslation();

  const normalizedStatus = ticket.status?.toUpperCase().replace(/^CANCELED$/, 'CANCELLED');
  const statusLabel = normalizedStatus
    ? t(`cinebot.ticket.status.${normalizedStatus}`, { defaultValue: ticket.status })
    : null;

  const seatList = ticket.seats
    ? ticket.seats
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="rounded-xl border border-outline-variant/80 bg-surface-container-lowest p-3 shadow-sm dark:bg-surface-container-low">
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
          <Ticket className="h-3 w-3" aria-hidden="true" />
          {t('cinebot.ticket.orderNumber', { id: ticket.orderId })}
        </span>
        {statusLabel && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getStatusClasses(
              normalizedStatus,
            )}`}
          >
            {statusLabel}
          </span>
        )}
      </div>

      <h4 className="mt-2 text-sm font-semibold leading-snug text-on-surface">
        {ticket.movieTitle}
      </h4>

      <dl className="mt-2 space-y-1.5 text-xs text-on-surface-variant">
        {ticket.dateTime && (
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden="true" />
            <dt className="sr-only">{t('cinebot.ticket.showtime')}</dt>
            <dd className="truncate font-medium text-on-surface">{ticket.dateTime}</dd>
          </div>
        )}

        {ticket.theater && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden="true" />
            <dt className="sr-only">{t('cinebot.ticket.theater')}</dt>
            <dd className="truncate">{ticket.theater}</dd>
          </div>
        )}

        {ticket.room && (
          <div className="flex items-center gap-2">
            <DoorOpen className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden="true" />
            <dt className="sr-only">{t('cinebot.ticket.room')}</dt>
            <dd className="truncate">{ticket.room}</dd>
          </div>
        )}

        {seatList.length > 0 && (
          <div className="flex items-start gap-2 pt-0.5">
            <Armchair className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden="true" />
            <dt className="sr-only">{t('cinebot.ticket.seats')}</dt>
            <dd className="flex flex-wrap gap-1">
              {seatList.map((seat) => (
                <span
                  key={seat}
                  className="rounded border border-outline-variant/80 bg-surface-container px-1.5 py-0.5 text-[11px] font-semibold text-on-surface"
                >
                  {seat}
                </span>
              ))}
            </dd>
          </div>
        )}

        {ticket.total && (
          <div className="flex items-center gap-2">
            <Receipt className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden="true" />
            <dt className="sr-only">{t('cinebot.ticket.total')}</dt>
            <dd className="font-medium text-on-surface">{ticket.total}</dd>
          </div>
        )}
      </dl>

      <div className="mt-2.5 border-t border-outline-variant/60 pt-2">
        <Link
          to="/my-tickets"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary transition-colors hover:text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('cinebot.ticket.viewMyTickets')}
        </Link>
      </div>
    </div>
  );
}
