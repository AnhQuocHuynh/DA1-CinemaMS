import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Clock, TrendingUp, Ticket } from 'lucide-react';
import { staffService } from '../../services/staffService';
import { StaffLayout } from '../../components/staff/StaffLayout';
import { useTranslation } from 'react-i18next';

export const StaffDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [bookingsList, setBookingsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [dashboard, bookings] = await Promise.all([
          staffService.getStaffDashboard(),
          staffService.getBookingsList(),
        ]);
        setDashboardData(dashboard);
        setBookingsList(bookings);
      } catch (error) {
        console.error('Failed to load staff data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  return (
    <StaffLayout activeItemId="dashboard">
      {/* Title */}
          <section className="mb-6 md:mb-12 flex flex-col gap-4 md:gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold text-on-surface mb-1 sm:mb-2">{t('staffDashboard.title', 'Staff Dashboard 👔')}</h1>
              <p className="text-sm sm:text-base text-on-surface-variant">{t('staffDashboard.subtitle', "Manage today's bookings and customer service")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => navigate('/staff/bookings/new')}
                className="flex-1 sm:flex-none min-h-[44px] bg-surface-container-highest text-on-surface px-4 py-2 rounded-lg font-semibold text-sm hover:bg-surface-container-high transition-all flex items-center justify-center gap-2 border border-outline-variant"
              >
                <Ticket className="w-4 h-4" />
                {t('staffDashboard.newBooking', 'New Booking')}
              </button>
              <button
                onClick={() => navigate('/staff/qr-checker')}
                className="flex-1 sm:flex-none min-h-[44px] bg-primary text-on-primary px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                {t('staffDashboard.scanTickets', 'Scan Tickets')}
              </button>
            </div>
          </section>

          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-on-surface-variant">{t('staffDashboard.loading', 'Loading dashboard...')}</p>
            </div>
          ) : (
            <>
              {/* Quick Stats */}
              <section id="dashboard" className="mb-8 md:mb-12">
                <h2 className="text-xl sm:text-2xl font-bold text-on-surface mb-4 sm:mb-6">{t('staffDashboard.overview', "Today's Overview")}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div className="bg-surface-container rounded-xl p-4 sm:p-6 border border-outline-variant/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-on-surface-variant text-xs sm:text-sm mb-2">{t('staffDashboard.todayBookings', "Today's Bookings")}</p>
                        <p className="text-3xl sm:text-4xl font-bold text-primary">{dashboardData?.todayBookings}</p>
                      </div>
                      <Ticket className="w-7 h-7 sm:w-8 sm:h-8 text-primary opacity-50" />
                    </div>
                    <p className="text-xs text-success font-semibold mt-3 sm:mt-4">{t('staffDashboard.plus5', '+5 from yesterday')}</p>
                  </div>

                  <div className="bg-surface-container rounded-xl p-4 sm:p-6 border border-outline-variant/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-on-surface-variant text-xs sm:text-sm mb-2">{t('staffDashboard.totalTickets', 'Total Tickets Sold')}</p>
                        <p className="text-3xl sm:text-4xl font-bold text-success">{dashboardData?.totalTicketsSold}</p>
                      </div>
                      <TrendingUp className="w-7 h-7 sm:w-8 sm:h-8 text-success opacity-50" />
                    </div>
                    <p className="text-xs text-success font-semibold mt-3 sm:mt-4">{t('staffDashboard.plus12', '+12 from yesterday')}</p>
                  </div>

                  <div className="bg-surface-container rounded-xl p-4 sm:p-6 border border-outline-variant/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-on-surface-variant text-xs sm:text-sm mb-2">{t('staffDashboard.peakHour', 'Peak Hour')}</p>
                        <p className="text-2xl sm:text-3xl font-bold text-primary">{dashboardData?.peakHour}</p>
                      </div>
                      <Clock className="w-7 h-7 sm:w-8 sm:h-8 text-primary opacity-50" />
                    </div>
                    <p className="text-xs text-primary font-semibold mt-3 sm:mt-4">{t('staffDashboard.mostActivity', 'Most booking activity')}</p>
                  </div>
                </div>
              </section>

              {/* Bookings List */}
              <section id="bookings">
                <h2 className="text-xl sm:text-2xl font-bold text-on-surface mb-4 sm:mb-6 flex items-center gap-2">
                  <Ticket className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  {t('staffDashboard.recentBookings', 'Recent Bookings')}
                </h2>

                {/* Mobile Cards (< md) */}
                <div className="md:hidden space-y-3">
                  {bookingsList.map((booking, index) => (
                    <article
                      key={`dash-mobile-${index}`}
                      className="bg-surface-container rounded-xl p-4 border border-outline-variant/30 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-mono text-xs text-on-surface-variant">{booking.id}</span>
                          <p className="font-bold text-sm text-on-surface truncate">{booking.customer}</p>
                        </div>
                        <span className="px-2.5 py-1 bg-success-container text-on-success-container rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0">
                          {t('staffDashboard.confirmed', 'Confirmed')}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-on-surface">{booking.movieTitle}</p>
                      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-on-surface-variant">
                        <span>{booking.time}</span>
                        <span className="px-2.5 py-0.5 bg-primary-container text-on-primary-container rounded-full font-semibold whitespace-nowrap">
                          {t('staffDashboard.seatCount', { count: booking.seats, defaultValue: '{{count}} seats' })}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>

                {/* Desktop / Tablet Table (>= md) */}
                <div className="hidden md:block bg-surface-container rounded-xl overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface-container-high border-b border-outline-variant/30">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-bold text-on-surface">{t('staffDashboard.colId', 'Booking ID')}</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-on-surface">{t('staffDashboard.colCustomer', 'Customer')}</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-on-surface">{t('staffDashboard.colMovie', 'Movie')}</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-on-surface">{t('staffDashboard.colTime', 'Time')}</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-on-surface">{t('staffDashboard.colSeats', 'Seats')}</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-on-surface">{t('staffDashboard.colStatus', 'Status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookingsList.map((booking, index) => (
                        <tr key={index} className="border-b border-outline-variant/20 hover:bg-surface-container-low transition-colors">
                          <td className="px-6 py-4 text-on-surface font-mono text-sm">{booking.id}</td>
                          <td className="px-6 py-4 text-on-surface">{booking.customer}</td>
                          <td className="px-6 py-4 text-on-surface">{booking.movieTitle}</td>
                          <td className="px-6 py-4 text-on-surface">{booking.time}</td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-primary-container text-on-primary-container rounded-full text-xs font-semibold whitespace-nowrap">
                              {t('staffDashboard.seatCount', { count: booking.seats, defaultValue: '{{count}} seats' })}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-success-container text-on-success-container rounded-full text-xs font-semibold whitespace-nowrap">
                              {t('staffDashboard.confirmed', 'Confirmed')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
    </StaffLayout>
  );
};
