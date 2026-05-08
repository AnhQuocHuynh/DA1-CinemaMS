import React from 'react';
import { useParams } from 'react-router-dom';
import { PortalTopNav } from '../../components/portal/PortalTopNav';
import { useTicketDetails } from '../../hooks/useTicketDetails';

export const TicketInfo: React.FC = () => {
  const { ticketId = 'TDA-88291' } = useParams();
  const { ticket, isLoading } = useTicketDetails(ticketId);

  if (isLoading || !ticket) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant">Loading ticket...</p>
      </div>
    );
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <PortalTopNav activeLabel="My Tickets" />
      <main className="pt-24 pb-32 px-4 md:px-6 max-w-4xl mx-auto min-h-screen">
        <div className="mb-8">
          <button className="flex items-center gap-2 text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">
            ← Back to My Tickets
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-8">
            <div className="aspect-[2/3] w-full rounded-xl overflow-hidden shadow-2xl relative group">
              <img
                alt={ticket.movieTitle}
                className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-700"
                src={ticket.posterUrl}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/80 to-transparent"></div>
              <div className="absolute bottom-6 left-6">
                <span className="inline-block px-3 py-1 bg-primary text-on-primary text-[10px] font-bold tracking-widest uppercase mb-2">
                  {ticket.status}
                </span>
                <h2 className="text-2xl font-bold text-white tracking-tight">{ticket.movieTitle.toUpperCase()}</h2>
              </div>
            </div>
            <div className="bg-surface-container-low p-6 rounded-xl space-y-4">
              <p className="text-xs text-on-secondary-container leading-relaxed">
                Please arrive 20 minutes before the show starts. Digital tickets must be presented at the hall entrance.
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="relative bg-surface-container-lowest rounded-xl shadow-lg overflow-hidden flex flex-col">
              <div className="p-8 pb-10">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <h1 className="text-4xl font-black text-on-surface tracking-tighter mb-1">{ticket.movieTitle.toUpperCase()}</h1>
                    <p className="text-sm font-medium text-primary tracking-wide uppercase">Directed by {ticket.director}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">
                      Hall
                    </span>
                    <span className="text-3xl font-light tracking-tighter text-on-surface">{ticket.hall}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-8 gap-x-4">
                  <div>
                    <label className="text-[10px] font-bold tracking-widest uppercase text-outline mb-2 block">Date</label>
                    <p className="text-lg font-semibold text-on-surface">{ticket.date}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold tracking-widest uppercase text-outline mb-2 block">Time</label>
                    <p className="text-lg font-semibold text-on-surface">{ticket.time}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-outline mb-2 block">Venue</label>
                    <p className="text-lg font-semibold text-on-surface">{ticket.venue}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold tracking-widest uppercase text-outline mb-2 block">Seats</label>
                    <div className="flex gap-2 flex-wrap">
                      {ticket.seats.map((seat) => (
                        <span key={seat} className="px-3 py-1 bg-surface-container-high rounded font-bold text-on-primary-fixed-variant">
                          {seat}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-outline mb-2 block">Booking ID</label>
                    <p className="text-lg font-mono font-medium text-on-surface">#{ticket.id}</p>
                  </div>
                </div>
              </div>

              <div className="relative h-6 flex items-center">
                <div className="absolute -left-3 w-6 h-6 bg-surface rounded-full"></div>
                <div className="absolute -right-3 w-6 h-6 bg-surface rounded-full"></div>
                <div className="w-full border-t-2 border-dashed border-outline-variant mx-6"></div>
              </div>

              <div className="p-10 bg-surface-container-low flex flex-col items-center justify-center">
                <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
                  <img alt={`Entry QR code for ticket ${ticket.id}`} className="w-40 h-40" src={ticket.qrCodeUrl} />
                </div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-outline mb-4">Scan at Entrance</p>
                <div className="flex gap-4 w-full">
                  <button className="flex-1 flex items-center justify-center gap-2 bg-on-surface text-white py-3 rounded-lg font-semibold text-sm hover:bg-on-surface/90 transition-all">
                    Add to Wallet
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 bg-white border border-outline-variant text-on-surface py-3 rounded-lg font-semibold text-sm hover:bg-surface-container-lowest transition-all">
                    Print Ticket
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center px-2">
              <button className="text-sm font-medium text-error hover:underline">Cancel Ticket</button>
              <button className="text-sm font-medium text-primary hover:underline">Share with Friends</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
