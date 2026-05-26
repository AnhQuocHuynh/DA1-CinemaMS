import React, { useEffect, useState } from 'react';
import { Ticket } from 'lucide-react';
import { bookingService } from '../../services/bookingService';
import { SiteTopNav } from '../../components/SiteTopNav';

interface Booking {
  id: string;
  movieTitle: string;
  date: string;
  status: string;
  seats: string[];
}

export const UserDashboard: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const bookingsData = await bookingService.getUserBookings();
        setBookings(bookingsData);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SiteTopNav activeLabel="My Tickets" showSearch={false} />

      {/* Main Content */}
      <main className="pt-20 px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Welcome Section */}
          <section className="mb-12">
            <h1 className="text-4xl font-bold text-on-surface mb-2">My Tickets</h1>
            <p className="text-on-surface-variant">Review your upcoming bookings and ticket details.</p>
          </section>

          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-on-surface-variant">Loading content...</p>
            </div>
          ) : (
            <section id="bookings">
              <h2 className="text-2xl font-bold text-on-surface mb-6 flex items-center gap-2">
                <Ticket className="w-6 h-6 text-primary" />
                My Bookings ({bookings.length})
              </h2>
              {bookings.length > 0 ? (
                <div className="grid gap-4">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="bg-surface-container rounded-lg p-6 flex justify-between items-center border border-outline-variant/30">
                      <div className="flex-1">
                        <h3 className="font-bold text-on-surface mb-2">{booking.movieTitle}</h3>
                        <p className="text-sm text-on-surface-variant mb-1">Date: {booking.date}</p>
                        <p className="text-sm text-on-surface-variant">Seats: {booking.seats.join(', ')}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                          {booking.status}
                        </span>
                        <button className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-blue-700 transition-all">
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-surface-container rounded-lg p-8 text-center">
                  <Ticket className="w-12 h-12 text-outline-variant mx-auto mb-4 opacity-50" />
                  <p className="text-on-surface-variant mb-4">No bookings yet</p>
                  <p className="text-sm text-on-surface-variant">Book a movie from the home page to see it here.</p>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

