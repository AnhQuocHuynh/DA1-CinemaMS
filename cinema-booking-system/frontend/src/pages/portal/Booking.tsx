import React from 'react';
import { ArrowRight, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PortalTopNav } from '../../components/portal/PortalTopNav';
import { SeatLegend } from '../../components/portal/SeatLegend';
import { SeatMapGrid } from '../../components/portal/SeatMapGrid';
import { useSeatSelection } from '../../hooks/useSeatSelection';

export const Booking: React.FC = () => {
  const navigate = useNavigate();
  const { seatMap, selectedSeats, isSelected, toggleSeat, summary, isLoading } = useSeatSelection('showtime-1');

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <PortalTopNav activeLabel="Showtimes" />
      <main className="pt-24 pb-20 px-6 max-w-7xl mx-auto flex flex-col lg:flex-row gap-12">
        <div className="flex-grow">
          <div className="mb-12">
            <h1 className="text-2xl font-medium tracking-tight text-on-surface mb-2">Select Your Seats</h1>
            <p className="text-on-surface-variant text-sm">
              Interstellar: 10th Anniversary Re-release • IMAX 70mm • 8:30 PM
            </p>
          </div>

          <div className="flex flex-col items-center mb-16">
            <div className="w-full max-w-2xl bg-surface-container-highest/20 h-12 rounded-t-[100%] flex items-center justify-center relative">
              <div className="absolute bottom-0 w-4/5 h-1 bg-gradient-to-r from-transparent via-primary to-transparent blur-[1px]"></div>
            </div>
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-outline mt-4">Screen</span>
          </div>

          {isLoading || !seatMap ? (
            <div className="text-center py-10 text-on-surface-variant">Loading seat map...</div>
          ) : (
            <div className="perspective-container">
              <div className="perspective-map">
                <SeatMapGrid seatMap={seatMap} isSelected={isSelected} onSeatToggle={toggleSeat} />
              </div>
            </div>
          )}

          <SeatLegend />
        </div>

        <aside className="w-full lg:w-80 shrink-0">
          <div className="sticky top-28 space-y-6">
            <div className="bg-inverse-surface text-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold tracking-widest uppercase opacity-70">Session Expires</span>
                <span className="text-sm">09:42</span>
              </div>
              <div className="text-3xl font-black tracking-tighter tabular-nums">09:42</div>
              <div className="mt-4 h-1 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-primary-container w-[80%]"></div>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 space-y-6">
              <div>
                <h3 className="text-[10px] font-bold tracking-widest uppercase text-outline mb-4">Selected Seats</h3>
                <div className="space-y-3">
                  {selectedSeats.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">No seats selected.</p>
                  ) : (
                    selectedSeats.map((seat) => (
                      <div key={seat.id} className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-surface-container-high rounded flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">{seat.label}</span>
                          </div>
                          <span className="text-sm font-medium">Standard IMAX</span>
                        </div>
                        <span className="text-sm font-semibold text-on-surface">${seat.price.toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-outline-variant/20">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-on-surface-variant">Subtotal</span>
                  <span className="text-sm font-medium">${summary.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-6">
                  <span className="text-xs text-on-surface-variant">Fees & Taxes</span>
                  <span className="text-sm font-medium">${summary.fees.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold uppercase tracking-tight">Total</span>
                  <span className="text-2xl font-black tracking-tighter text-primary">${summary.total.toFixed(2)}</span>
                </div>
              </div>

              <button
                className="w-full py-4 bg-primary text-white font-bold tracking-tight rounded-lg hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                onClick={() => navigate('/user/checkout')}
              >
                Proceed to Checkout
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-[10px] text-center text-outline leading-relaxed px-4">
                By clicking "Proceed to Checkout", you agree to our terms of service and reservation policy.
              </p>
            </div>

            <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-lg">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white">
                <Info className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface">Need assistance?</p>
                <p className="text-xs text-on-surface-variant">Call (555) 012-3456</p>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};
