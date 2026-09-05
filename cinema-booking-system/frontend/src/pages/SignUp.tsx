import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import { authService } from '@/services/authService';
import genericMovieBg from '../resources/generic_movie_bg.png';

export const SignUp: React.FC = () => {
  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">

      <main className="flex-grow pt-16 relative overflow-hidden">
        <div className="absolute inset-0 z-0 grid grid-cols-12 gap-4 opacity-5 pointer-events-none px-8">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="border-r border-outline-variant h-full"></div>
          ))}
        </div>

        <div className="absolute -top-24 -left-24 w-72 h-72 bg-surface-container-high rounded-full blur-3xl opacity-60"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-surface-container-low rounded-full blur-3xl opacity-60"></div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-14 md:py-18 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <section className="space-y-8">
            <div>
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">
                Member Registration
              </span>
              <p className="text-on-surface-variant text-sm md:text-base mt-4 max-w-xl">
                Build a dedicated booking profile with faster checkout, protected seat holds, and a
                consolidated ticket vault.
              </p>
            </div>

            <div className="rounded-2xl overflow-hidden border border-outline-variant/40 bg-surface-container-lowest">
              <div className="relative aspect-[16/9]">
                <img
                  className="w-full h-full object-cover"
                  src={genericMovieBg}
                  alt="Cinema hall seats"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-surface-container-highest/80 via-surface-container-low/40 to-transparent" />
                <div className="absolute bottom-6 left-6">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                    Priority onboarding
                  </span>
                  <p className="text-sm text-on-surface mt-2 max-w-sm">
                    Lock seats in real time with instant checkout and order tracking.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6">
                {[
                  { label: 'Seat Holds', value: 'Synced' },
                  { label: 'Ticket Vault', value: 'Encrypted' },
                  { label: 'Refunds', value: 'Tracked' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl bg-surface-container-low p-4 border border-outline-variant/30"
                  >
                    <div className="text-xl font-semibold tracking-tight text-on-surface">{item.value}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-2">
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/40 p-6">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                Booking promise
              </div>
              <p className="text-sm text-on-surface mt-3">
                Your seats stay locked while you check out. The hold timer syncs to live inventory
                and releases automatically when sessions expire.
              </p>
            </div>
          </section>

          <section className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/40 overflow-hidden">
            <div className="px-8 pt-10 pb-6">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Link>

              <div className="flex items-center justify-between mb-8 mt-6">
                <div>
                  <span className="text-xl font-black tracking-tighter text-on-surface block">
                    CinemaArchitect
                  </span>
                  <h2 className="text-2xl font-semibold tracking-tight text-on-surface mt-1">
                    Create Account
                  </h2>
                  <p className="text-on-surface-variant text-sm mt-2">
                    Open a booking profile with verified access via Keycloak.
                  </p>
                </div>                
              </div>

              <div className="pt-2 space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-outline-variant/40 bg-surface-container-low p-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                      Access Tier
                    </div>
                    <div className="text-sm font-semibold text-on-surface mt-1">Standard Member</div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                    Ready
                  </span>
                </div>

                <button
                  onClick={() => authService.register()}
                  className="w-full py-4 bg-primary text-on-primary rounded-lg font-bold text-sm tracking-wide shadow-lg shadow-blue-600/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  CONTINUE TO REGISTRATION
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="border-t border-outline-variant/30 px-8 py-6 text-center">
              <p className="text-[11px] text-on-surface-variant">
                By creating an account, you agree to our booking terms and privacy policy.
              </p>
              <p className="text-sm text-on-surface-variant mt-4">
                Already have an account?{' '}
                <button onClick={() => authService.login()} className="text-primary font-bold hover:underline">
                  Sign In
                </button>
              </p>
            </div>

            <div className="bg-surface-container-low p-4 text-center">
              <p className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest flex items-center justify-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                Secure Architect Environment
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
