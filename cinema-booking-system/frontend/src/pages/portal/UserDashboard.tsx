import React, { useEffect, useState } from 'react';
import { Ticket, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { bookingService } from '../../services/bookingService';
import { SiteTopNav } from '../../components/SiteTopNav';
import { useAuthStore } from '../../store/authStore';
import { formatVND, parseVND } from '../../utils/formatters';
import { useTranslation } from 'react-i18next';

interface UserTicket {
  id: number;
  orderId: number;
  ticketCode: string;
  price: string;
  status: string;
  createdAt: string;
  movieName?: string;
  showtimeDateTime?: string;
  cinemaName?: string;
}

const STATUS_CLASSES: Record<string, string> = {
  VALID: 'bg-primary/10 text-primary',
  CHECKED_IN: 'bg-success-container text-on-success-container',
  CANCELLED: 'bg-error/10 text-error',
  USED: 'bg-surface-container text-on-surface-variant',
};

export const UserDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

    bookingService
      .getUserTickets(userId)
      .then(setTickets)
      .catch(() => setError(t('userDashboard.loadError')))
      .finally(() => setIsLoading(false));
  }, [user]);

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <SiteTopNav activeLabel="My Tickets" showSearch={false} />

      <main className="pt-20 px-8 pb-8">
        <div className="max-w-4xl mx-auto">
          <section className="mb-10">
            <h1 className="text-4xl font-bold text-on-surface mb-2">{t('userDashboard.title')}</h1>
            <p className="text-on-surface-variant">
              {t('userDashboard.subtitle')}
            </p>
          </section>

          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-on-surface-variant animate-pulse">{t('userDashboard.loading')}</p>
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 bg-error/10 text-error border border-error/30 rounded-lg p-4">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : tickets.length > 0 ? (
            <div className="grid gap-4">
              {tickets.map((t_ticket) => {
                const statusClass = STATUS_CLASSES[t_ticket.status] ?? 'bg-surface-container text-on-surface-variant';
                const statusLabel = t(`userDashboard.status.${t_ticket.status}`, t_ticket.status);
                
                return (
                  <div
                    key={t_ticket.ticketCode}
                    className="bg-surface-container-lowest rounded-xl p-6 flex justify-between items-center border border-outline-variant/30 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Ticket className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        {t_ticket.movieName && (
                          <p className="font-bold text-base text-on-surface mb-0.5">
                            {t_ticket.movieName.toUpperCase()}
                          </p>
                        )}
                        <p className="font-mono text-sm font-bold text-on-surface-variant mb-1">
                          {t_ticket.ticketCode}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          {t('userDashboard.bookedOn')}{' '}
                          {new Date(t_ticket.createdAt).toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}
                        </p>
                        <p className="text-sm font-semibold text-primary mt-1">
                          {formatVND(parseVND(t_ticket.price))}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClass}`}
                      >
                        {statusLabel}
                      </span>
                      <Link
                        to={`/user/tickets/${t_ticket.ticketCode}`}
                        className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:opacity-90 transition-colors"
                      >
                        {t('userDashboard.viewTicket')}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-surface-container rounded-lg p-12 text-center border border-outline-variant/20">
              <Ticket className="w-14 h-14 text-outline-variant mx-auto mb-4 opacity-40" />
              <p className="text-on-surface-variant font-medium mb-2">{t('userDashboard.noTickets')}</p>
              <p className="text-sm text-on-surface-variant mb-6">
                {t('userDashboard.startBooking')}
              </p>
              <Link
                to="/"
                className="inline-block px-6 py-3 bg-primary text-on-primary rounded-lg font-semibold text-sm hover:opacity-90 transition-colors"
              >
                {t('userDashboard.findMovie')}
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
