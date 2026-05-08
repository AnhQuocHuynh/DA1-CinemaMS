import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Download, Share2 } from 'lucide-react';

export const CheckoutSuccess: React.FC = () => {
  return (
    <main className="min-h-screen bg-surface flex items-center justify-center px-6 py-20">
      <div className="max-w-2xl w-full bg-surface-container-lowest rounded-2xl shadow-xl p-10 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mx-auto">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mt-6">Payment Confirmed</h1>
        <p className="text-on-surface-variant mt-3">
          Your seats are secured. A digital ticket has been generated and sent to your email.
        </p>

        <div className="mt-8 bg-surface-container-low p-6 rounded-xl text-left">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400">Booking ID</p>
              <p className="text-lg font-bold">#TDA-88291</p>
            </div>
            <span className="px-3 py-1 bg-primary text-white text-[10px] uppercase tracking-widest rounded">Confirmed</span>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div>
              <p className="text-xs text-slate-500">Movie</p>
              <p className="font-semibold">Interstellar</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Showtime</p>
              <p className="font-semibold">Oct 24, 08:30 PM</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Venue</p>
              <p className="font-semibold">IMAX-04</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Seats</p>
              <p className="font-semibold">H-12, H-13</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col md:flex-row gap-4">
          <Link
            to="/user/tickets/TDA-88291"
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-lg font-semibold"
          >
            View Ticket
          </Link>
          <button className="flex-1 flex items-center justify-center gap-2 bg-white border border-outline-variant py-3 rounded-lg font-semibold">
            <Download className="w-4 h-4" />
            Download PDF
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 bg-white border border-outline-variant py-3 rounded-lg font-semibold">
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
      </div>
    </main>
  );
};
