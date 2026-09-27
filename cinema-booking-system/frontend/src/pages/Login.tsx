import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, ArrowLeft, ArrowRight, Lock, Mail } from 'lucide-react';
import { Header } from '../components/Header';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';

export const Login: React.FC = () => {
  const { user, token } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && token) {
      if (user.role === 'ADMIN') navigate('/admin/dashboard', { replace: true });
      else if (user.role === 'STAFF') navigate('/staff/dashboard', { replace: true });
      else navigate('/', { replace: true });
    }
  }, [user, token, navigate]);

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow pt-16 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute inset-0 z-0 grid grid-cols-12 gap-4 opacity-5 pointer-events-none px-8">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="border-r border-outline-variant h-full"></div>
          ))}
        </div>

        {/* Featured Carousel Background */}
        <div className="max-w-7xl mx-auto mt-8 px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="col-span-2 aspect-[16/9] rounded-xl overflow-hidden bg-surface-container-low relative">
            <img
              className="w-full h-full object-cover grayscale opacity-40"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD5GY2DMOxWkqIII8zWLrBLyU31RYfT6sWib8PiNi_lf5O_MAE1K_sz88wcSlJcSCRwW6sTs-NXRi9jXZOU7sP27URXl7fAvWYuglEGmN_GPUm4SEgXVy-rZrjCKD9rwNohBvrw87_Db8nk21UulaJ-dISa7GcemdrmfeG9yFEYVWFw8LXhDbqTE5Wj0vI8RIFTGq3BlSpTHKJLQqUcpqaipJ26wMes8PODjKKbs-y3_-mymgDIOv-Kz9iQN5cLQQ-_2aWOmHLXpmk"
              alt="Featured cinema theater"
            />
            <div className="absolute bottom-12 left-12">
              <span className="bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 mb-4 inline-block">
                Featured Release
              </span>
              <h2 className="text-5xl font-extrabold tracking-tighter text-on-surface mb-2">
                Interstellar: Architect Edition
              </h2>
              <p className="text-on-surface-variant max-w-md">
                Experience cinematic precision in our new ultra-wide laser projection halls.
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="p-8 bg-surface-container-highest rounded-xl">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest mb-4 block">
                System Status
              </span>
              <div className="text-3xl font-medium tracking-tight mb-2">99.8%</div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Network efficiency across London Terminal theaters during peak hours.
              </p>
            </div>

            <div className="p-8 bg-inverse-surface text-inverse-on-surface rounded-xl">
              <span className="text-[10px] font-bold text-surface-variant uppercase tracking-widest mb-4 block">
                Quick Stats
              </span>
              <div className="flex items-center gap-2 mb-1">
                <LogIn className="w-5 h-5" />
                <span className="text-xl font-bold">12,402</span>
              </div>
              <p className="text-xs opacity-70">Tickets booked in the last 24 hours.</p>
            </div>
          </div>
        </div>

        {/* AUTH MODAL OVERLAY */}
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-white"></div>
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col transform transition-all">
            <div className="p-8 sm:p-10">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Link>

              <div className="mb-10 text-center mt-6">
                <span className="text-xl font-black tracking-tighter text-on-surface block mb-2">
                  CinemaArchitect
                </span>
                <h1 className="text-2xl font-semibold tracking-tight text-on-surface">Welcome Back</h1>
                <p className="text-on-surface-variant text-sm mt-1">
                  Click below to securely log in to the portal via Keycloak.
                </p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => authService.login()}
                  className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold text-sm tracking-wide shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  SIGN IN TO PORTAL
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-8 pt-8 border-t border-outline-variant/30 text-center">
                <p className="text-sm text-on-surface-variant">
                  Don't have an account?{' '}
                  <button onClick={() => authService.register()} className="text-primary font-bold hover:underline">
                    Create Portal ID
                  </button>
                </p>
              </div>
            </div>

            <div className="bg-surface-container-low p-4 text-center">
              <p className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest flex items-center justify-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                Secure Architect Environment
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Navigation (Mobile Only) */}
      <footer className="md:hidden fixed bottom-0 w-full glass-header flex justify-around items-center h-16 px-4 z-50 bg-white/80 backdrop-blur-md">
        <a href="#" className="flex flex-col items-center text-primary">
          <LogIn className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Home</span>
        </a>
        <a href="#" className="flex flex-col items-center text-slate-500">
          <Mail className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Movies</span>
        </a>
        <a href="#" className="flex flex-col items-center text-slate-500">
          <LogIn className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Tickets</span>
        </a>
        <a href="#" className="flex flex-col items-center text-slate-500">
          <Mail className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Profile</span>
        </a>
      </footer>
    </div>
  );
};
