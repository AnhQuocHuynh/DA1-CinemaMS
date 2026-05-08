import React from 'react';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCheckoutSummary } from '../../hooks/useCheckoutSummary';

export const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { summary, isLoading } = useCheckoutSummary();

  return (
    <main className="min-h-screen flex flex-col items-center py-12 px-6 md:py-20 bg-surface">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-12 mb-4">
          <div className="flex items-center gap-4 mb-8">
            <button className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-container-low hover:bg-surface-container-high transition-colors">
              ←
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-on-surface">Review Order</h1>
              <p className="text-sm text-on-surface-variant font-medium uppercase tracking-widest">Step 3 of 3: Checkout</p>
            </div>
          </div>
        </div>

        {isLoading || !summary ? (
          <div className="lg:col-span-12 text-center text-on-surface-variant">Loading checkout...</div>
        ) : (
          <>
            <div className="lg:col-span-7 space-y-10">
              <section className="bg-surface-container-lowest rounded-xl p-8 shadow-sm">
                <div className="flex justify-between items-start mb-10">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-outline">Selected Feature</span>
                    <h2 className="text-2xl font-bold text-on-surface tracking-tight">{summary.movieTitle}</h2>
                    <div className="flex items-center gap-2 mt-2 text-sm text-on-secondary-fixed-variant">
                      {summary.venue}
                    </div>
                  </div>
                  <div className="w-20 h-28 rounded bg-surface-container-low"></div>
                </div>

                <div className="grid grid-cols-2 gap-y-8 border-t border-surface-container-low pt-8">
                  <div>
                    <p className="text-[10px] font-bold tracking-widest uppercase text-outline mb-1">Date & Time</p>
                    <p className="text-sm font-semibold text-on-surface">{summary.showtime}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-widest uppercase text-outline mb-1">Selected Seats</p>
                    <p className="text-sm font-semibold text-on-surface">{summary.seats.join(', ')}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-outline mb-4">Pricing Breakdown</p>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-on-surface-variant">Standard Rate</span>
                        <span className="font-medium text-on-surface">${summary.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-on-surface-variant">Architect Convenience Fee</span>
                        <span className="font-medium text-on-surface">${summary.fees.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-surface-container-low rounded-lg p-6 flex flex-col md:flex-row items-center gap-4">
                <div className="flex-1 w-full">
                  <label className="text-[10px] font-bold tracking-widest uppercase text-outline block mb-2" htmlFor="promo">
                    Promotion Code
                  </label>
                  <input
                    className="w-full bg-surface-container-lowest border-none focus:ring-0 text-sm font-bold tracking-widest uppercase h-12 px-4 rounded"
                    id="promo"
                    placeholder="ENTER CODE"
                    type="text"
                  />
                </div>
                <button className="w-full md:w-auto px-8 h-12 bg-inverse-surface text-white text-xs font-bold tracking-widest uppercase hover:bg-on-surface transition-all active:scale-95">
                  Apply
                </button>
              </section>
            </div>

            <div className="lg:col-span-5">
              <div className="sticky top-12 space-y-6">
                <section className="bg-surface-container-lowest rounded-xl p-8 shadow-sm border-t-4 border-primary">
                  <h3 className="text-[11px] font-bold tracking-widest uppercase text-outline mb-8 text-center">Payment Gateway</h3>
                  <div className="space-y-3 mb-10">
                    <label className="group relative flex items-center p-4 border border-surface-container-low rounded-lg cursor-pointer hover:bg-surface-container-low transition-all">
                      <input defaultChecked className="sr-only peer" name="payment" type="radio" />
                      <div className="w-5 h-5 border-2 border-outline-variant rounded-full flex items-center justify-center peer-checked:border-primary peer-checked:bg-primary mr-4 transition-all">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                      <div className="flex flex-1 items-center justify-between">
                        <span className="text-sm font-semibold text-on-surface">Credit / Debit Card</span>
                      </div>
                    </label>
                    <label className="group relative flex items-center p-4 border border-surface-container-low rounded-lg cursor-pointer hover:bg-surface-container-low transition-all">
                      <input className="sr-only peer" name="payment" type="radio" />
                      <div className="w-5 h-5 border-2 border-outline-variant rounded-full flex items-center justify-center peer-checked:border-primary peer-checked:bg-primary mr-4 transition-all">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                      <div className="flex flex-1 items-center justify-between">
                        <span className="text-sm font-semibold text-on-surface">Unified Payments Interface (UPI)</span>
                      </div>
                    </label>
                    <label className="group relative flex items-center p-4 border border-surface-container-low rounded-lg cursor-pointer hover:bg-surface-container-low transition-all">
                      <input className="sr-only peer" name="payment" type="radio" />
                      <div className="w-5 h-5 border-2 border-outline-variant rounded-full flex items-center justify-center peer-checked:border-primary peer-checked:bg-primary mr-4 transition-all">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                      <div className="flex flex-1 items-center justify-between">
                        <span className="text-sm font-semibold text-on-surface">Net Banking</span>
                      </div>
                    </label>
                  </div>

                  <div className="border-t border-surface-container-low pt-8">
                    <div className="flex justify-between items-end mb-8">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-outline">Total Amount Due</span>
                      <span className="text-3xl font-extrabold text-on-surface tracking-tighter leading-none">
                        ${summary.total.toFixed(2)}
                      </span>
                    </div>
                    <button
                      className="w-full bg-primary text-white py-5 rounded shadow-lg shadow-primary/20 hover:bg-surface-tint active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                      onClick={() => navigate('/user/checkout-success')}
                    >
                      <span className="text-sm font-bold tracking-widest uppercase">Confirm & Pay</span>
                      <Lock className="w-4 h-4" />
                    </button>
                    <p className="text-center text-[10px] text-outline mt-6 flex items-center justify-center gap-2">
                      SECURE 256-BIT ENCRYPTED TRANSACTION
                    </p>
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
};
