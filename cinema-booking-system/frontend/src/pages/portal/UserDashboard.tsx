import React, { useEffect, useState } from 'react';
import { Ticket, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { bookingService } from '../../services/bookingService';
import { SiteTopNav } from '../../components/SiteTopNav';
import { useAuthStore } from '../../store/authStore';
import { formatVND, parseVND } from '../../utils/formatters';

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

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  VALID: { label: 'Hợp lệ', className: 'bg-primary/10 text-primary' },
  CHECKED_IN: { label: 'Đã vào', className: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Đã huỷ', className: 'bg-error/10 text-error' },
  USED: { label: 'Đã dùng', className: 'bg-slate-100 text-slate-600' },
};

export const UserDashboard: React.FC = () => {
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

    bookingService
      .getUserTickets(userId)
      .then(setTickets)
      .catch(() => setError('Không thể tải danh sách vé.'))
      .finally(() => setIsLoading(false));
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SiteTopNav activeLabel="My Tickets" showSearch={false} />

      <main className="pt-20 px-8 pb-8">
        <div className="max-w-4xl mx-auto">
          <section className="mb-10">
            <h1 className="text-4xl font-bold text-on-surface mb-2">Vé của tôi</h1>
            <p className="text-on-surface-variant">
              Xem thông tin và quản lý các vé đã đặt của bạn.
            </p>
          </section>

          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-on-surface-variant animate-pulse">Đang tải vé...</p>
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 bg-error/10 text-error border border-error/30 rounded-lg p-4">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : tickets.length > 0 ? (
            <div className="grid gap-4">
              {tickets.map((t) => {
                const statusMeta = STATUS_LABELS[t.status] ?? {
                  label: t.status,
                  className: 'bg-slate-100 text-slate-600',
                };
                return (
                  <div
                    key={t.ticketCode}
                    className="bg-white rounded-xl p-6 flex justify-between items-center border border-outline-variant/30 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Ticket className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        {t.movieName && (
                          <p className="font-bold text-base text-on-surface mb-0.5">
                            {t.movieName.toUpperCase()}
                          </p>
                        )}
                        <p className="font-mono text-sm font-bold text-on-surface-variant mb-1">
                          {t.ticketCode}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Đặt ngày{' '}
                          {new Date(t.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                        <p className="text-sm font-semibold text-primary mt-1">
                          {formatVND(parseVND(t.price))}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${statusMeta.className}`}
                      >
                        {statusMeta.label}
                      </span>
                      <Link
                        to={`/user/tickets/${t.ticketCode}`}
                        className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                      >
                        Xem vé
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-surface-container rounded-lg p-12 text-center border border-outline-variant/20">
              <Ticket className="w-14 h-14 text-outline-variant mx-auto mb-4 opacity-40" />
              <p className="text-on-surface-variant font-medium mb-2">Chưa có vé nào</p>
              <p className="text-sm text-on-surface-variant mb-6">
                Hãy đặt vé từ trang chủ để xem vé tại đây.
              </p>
              <Link
                to="/"
                className="inline-block px-6 py-3 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors"
              >
                Tìm phim
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
