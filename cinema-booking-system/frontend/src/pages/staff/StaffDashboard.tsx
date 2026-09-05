import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Clock, TrendingUp, Ticket } from 'lucide-react';
import { staffService } from '../../services/staffService';
import { StaffLayout } from '../../components/staff/StaffLayout';

export const StaffDashboard: React.FC = () => {
  const navigate = useNavigate();

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
          <section className="mb-12 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-on-surface mb-2">Staff Dashboard 👔</h1>
              <p className="text-on-surface-variant">Manage today's bookings and customer service</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/staff/bookings/new')}
                className="bg-surface-container-highest text-on-surface px-4 py-2 rounded-lg font-semibold text-sm hover:bg-surface-container-high transition-all flex items-center gap-2 border border-outline-variant"
              >
                <Ticket className="w-4 h-4" />
                New Booking
              </button>
              <button
                onClick={() => navigate('/staff/qr-checker')}
                className="bg-primary text-on-primary px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-all flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Scan Tickets
              </button>
            </div>
          </section>

          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-on-surface-variant">Loading dashboard...</p>
            </div>
          ) : (
            <>
              {/* Quick Stats */}
              <section id="dashboard" className="mb-12">
                <h2 className="text-2xl font-bold text-on-surface mb-6">Today's Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-surface-container rounded-xl p-6 border border-outline-variant/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-on-surface-variant text-sm mb-2">Today's Bookings</p>
                        <p className="text-4xl font-bold text-primary">{dashboardData?.todayBookings}</p>
                      </div>
                      <Ticket className="w-8 h-8 text-primary opacity-50" />
                    </div>
                    <p className="text-xs text-success font-semibold mt-4">+5 from yesterday</p>
                  </div>

                  <div className="bg-surface-container rounded-xl p-6 border border-outline-variant/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-on-surface-variant text-sm mb-2">Total Tickets Sold</p>
                        <p className="text-4xl font-bold text-success">{dashboardData?.totalTicketsSold}</p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-success opacity-50" />
                    </div>
                    <p className="text-xs text-success font-semibold mt-4">+12 from yesterday</p>
                  </div>

                  <div className="bg-surface-container rounded-xl p-6 border border-outline-variant/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-on-surface-variant text-sm mb-2">Peak Hour</p>
                        <p className="text-3xl font-bold text-primary">{dashboardData?.peakHour}</p>
                      </div>
                      <Clock className="w-8 h-8 text-primary opacity-50" />
                    </div>
                    <p className="text-xs text-primary font-semibold mt-4">Most booking activity</p>
                  </div>
                </div>
              </section>

              {/* Bookings List */}
              <section id="bookings">
                <h2 className="text-2xl font-bold text-on-surface mb-6 flex items-center gap-2">
                  <Ticket className="w-6 h-6 text-primary" />
                  Recent Bookings
                </h2>
                <div className="bg-surface-container rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-surface-container-high border-b border-outline-variant/30">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-bold text-on-surface">Booking ID</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-on-surface">Customer</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-on-surface">Movie</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-on-surface">Time</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-on-surface">Seats</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-on-surface">Status</th>
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
                            <span className="px-3 py-1 bg-primary-container text-on-primary-container rounded-full text-xs font-semibold">
                              {booking.seats} seats
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-success-container text-on-success-container rounded-full text-xs font-semibold">
                              Confirmed
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
