import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { Header } from '../components/Header';
import { authService } from '../services/authService';

export const ForgotPassword: React.FC = () => {
  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      <Header />

      <main className="flex-grow pt-16 relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 z-0 grid grid-cols-12 gap-4 opacity-5 pointer-events-none px-8">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="border-r border-outline-variant h-full"></div>
          ))}
        </div>

        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"></div>

          <div className="relative w-full max-w-md bg-surface-container-lowest rounded-xl shadow-2xl overflow-hidden">
            <div className="p-8 sm:p-10">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface mb-6"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>

              <div className="mb-10 text-center">
                <span className="text-xl font-black tracking-tighter text-on-surface block mb-2">
                  CinemaArchitect
                </span>
                <h1 className="text-2xl font-semibold tracking-tight text-on-surface">Reset Password</h1>
                <p className="text-on-surface-variant text-sm mt-1">
                  Click below to securely reset your password via Keycloak.
                </p>
              </div>

              <button
                onClick={() => authService.forgotPassword()}
                className="w-full py-4 bg-primary text-on-primary rounded-lg font-bold text-sm tracking-wide shadow-lg shadow-primary/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                CONTINUE TO PASSWORD RESET
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="mt-8 pt-8 border-t border-outline-variant/30 text-center">
                <p className="text-sm text-on-surface-variant">
                  Remember your password?{' '}
                  <button onClick={() => authService.login()} className="text-primary font-bold hover:underline">
                    Sign In
                  </button>
                </p>
              </div>
            </div>

            <div className="bg-surface-container-low p-4 text-center">
              <p className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest flex items-center justify-center gap-2">
                <Mail className="w-3.5 h-3.5" />
                Secure Architect Environment
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
