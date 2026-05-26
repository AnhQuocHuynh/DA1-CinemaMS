import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Clock, TrendingUp, Ticket } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { staffService } from '../../services/staffService';
import { authService } from '../../services/authService';

export const StaffDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
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

  const handleLogout = async () => {
    console.log('👔 [STAFF] Logout clicked');
    await authService.logout();
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md shadow-sm h-16 flex justify-between items-center px-8">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tighter text-slate-900">CinemaArchitect - Staff</span>
          <div className="hidden md:flex space-x-6">
            <a href="#dashboard" className="text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm">
              Dashboard
            </a>
            <a href="#bookings" className="text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm">
              Bookings
            </a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="bg-error text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-red-700 transition-all flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Title */}
          <section className="mb-12">
            <h1 className="text-4xl font-bold text-on-surface mb-2">Staff Dashboard 👔</h1>
            <p className="text-on-surface-variant">Manage today's bookings and customer service</p>
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
                    <p className="text-xs text-green-600 font-semibold mt-4">+5 from yesterday</p>
                  </div>

                  <div className="bg-surface-container rounded-xl p-6 border border-outline-variant/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-on-surface-variant text-sm mb-2">Total Tickets Sold</p>
                        <p className="text-4xl font-bold text-green-600">{dashboardData?.totalTicketsSold}</p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-green-600 opacity-50" />
                    </div>
                    <p className="text-xs text-green-600 font-semibold mt-4">+12 from yesterday</p>
                  </div>

                  <div className="bg-surface-container rounded-xl p-6 border border-outline-variant/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-on-surface-variant text-sm mb-2">Peak Hour</p>
                        <p className="text-3xl font-bold text-blue-600">{dashboardData?.peakHour}</p>
                      </div>
                      <Clock className="w-8 h-8 text-blue-600 opacity-50" />
                    </div>
                    <p className="text-xs text-blue-600 font-semibold mt-4">Most booking activity</p>
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
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                              {booking.seats} seats
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
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
        </div>
      </main>

      {/* Mobile Navigation */}
      <footer className="md:hidden fixed bottom-0 w-full bg-white/80 backdrop-blur-md flex justify-around items-center h-16 z-50">
        <a href="#dashboard" className="flex flex-col items-center text-primary text-center">
          <TrendingUp className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Dashboard</span>
        </a>
        <a href="#bookings" className="flex flex-col items-center text-slate-500 text-center hover:text-primary">
          <Ticket className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Bookings</span>
        </a>
      </footer>
    </div>
  );
};
