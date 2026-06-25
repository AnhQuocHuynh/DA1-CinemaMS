import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, ArrowLeft, LogIn, AlertCircle } from 'lucide-react';
import { InputField } from '../components/InputField';
import { Header } from '../components/Header';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { ApiErrorResponse, LoginFormData } from '../types/auth';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, setToken } = useAuthStore();
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Partial<LoginFormData>>({});
  const [generalError, setGeneralError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Partial<LoginFormData> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[name as keyof LoginFormData]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGeneralError('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {


      const response = await authService.login(formData);
      console.log('Login successful:', response);
      setUser(response.user);
      setToken(response.token);
      const role = response.user.role.toLowerCase();
      if (role === 'user') {
        navigate('/');
      } else {
        navigate(`/${role}/dashboard`);
      }
    } catch (error) {
      console.error('Login error:', error);
      if (axios.isAxiosError<ApiErrorResponse>(error)) {
        const errorCode = error.response?.data?.errorCode;
        if (errorCode === 'USER_LOCKED') {
          setGeneralError('Your account is locked. Please contact support for more information.');
        } else {
          setGeneralError(error.response?.data?.message || 'Login failed. Please check your credentials and try again.');
        }
      } else if (error instanceof Error) {
        setGeneralError(error.message);
      } else {
        setGeneralError('Login failed. Please check your credentials and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      <Header />

      {/* Main Content Canvas */}
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
            {/* System Status Card */}
            <div className="p-8 bg-surface-container-highest rounded-xl">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest mb-4 block">
                System Status
              </span>
              <div className="text-3xl font-medium tracking-tight mb-2">99.8%</div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Network efficiency across London Terminal theaters during peak hours.
              </p>
            </div>

            {/* Quick Stats Card */}
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
          {/* Modal Backdrop: use white background for clean login page */}
          <div className="absolute inset-0 bg-white"></div>

          {/* Modal Card */}
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col transform transition-all">
            <div className="p-8 sm:p-10">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Link>

              {/* Branding & Title */}
              <div className="mb-10 text-center mt-6">
                <span className="text-xl font-black tracking-tighter text-on-surface block mb-2">
                  CinemaArchitect
                </span>
                <h1 className="text-2xl font-semibold tracking-tight text-on-surface">Welcome Back</h1>
                <p className="text-on-surface-variant text-sm mt-1">
                  Please enter your credentials to access the portal.
                </p>
              </div>

              {/* General Error Message */}
              {generalError && (
                <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-error mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-error">{generalError}</p>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Field */}
                <InputField
                  id="email"
                  label="Email Address"
                  type="email"
                  placeholder="name@company.com"
                  icon={Mail}
                  value={formData.email}
                  onChange={handleChange}
                  error={errors.email}
                  required
                />

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-1">
                    <label
                      htmlFor="password"
                      className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest"
                    >
                      Password <span className="text-error">*</span>
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
                    >
                      Forgot?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
                    <input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      className={`w-full pl-12 pr-4 py-3 bg-surface-container-highest border-none rounded-lg focus:ring-0 text-sm placeholder:text-outline-variant transition-all border-b-2 ${
                        errors.password
                          ? 'border-error focus:border-error'
                          : 'border-transparent focus:border-primary'
                      }`}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-[12px] text-error px-1">{errors.password}</p>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold text-sm tracking-wide shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'SIGNING IN...' : 'SIGN IN TO PORTAL'}
                    {!isLoading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </form>

              {/* Secondary Options */}
              <div className="mt-8 pt-8 border-t border-outline-variant/30 text-center">
                <p className="text-sm text-on-surface-variant">
                  Don't have an account?{' '}
                  <Link to="/signup" className="text-primary font-bold hover:underline">
                    Create Portal ID
                  </Link>
                </p>
              </div>
            </div>

            {/* Footer Tonal Zone */}
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
