import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, ArrowLeft, AlertCircle, Phone } from 'lucide-react';
import { InputField } from '../components/InputField';
import { authService } from '@/services/authService';
import genericMovieBg from '../resources/generic_movie_bg.png';

interface SignUpFormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
}

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<SignUpFormData>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });
  const [errors, setErrors] = useState<Partial<SignUpFormData>>({});
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Partial<SignUpFormData> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

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

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid 10-digit phone number';
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
    if (errors[name as keyof SignUpFormData]) {
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
      await authService.register({
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
      });
      console.log('✅ [SIGNUP] Account created successfully');
      navigate('/login');
    } catch (error: any) {
      console.error('❌ [SIGNUP] Error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create account. Email may already be in use.';
      setGeneralError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

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

              <div className="flex items-center justify-between mb-8">
                <div>
                  <span className="text-xl font-black tracking-tighter text-on-surface block">
                    CinemaArchitect
                  </span>
                  <h2 className="text-2xl font-semibold tracking-tight text-on-surface mt-1">
                    Create Account
                  </h2>
                  <p className="text-on-surface-variant text-sm mt-2">
                    Open a booking profile with verified access.
                  </p>
                </div>                
              </div>

              {generalError && (
                <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-error mt-0.5" />
                  <p className="text-sm text-error">{generalError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <InputField
                    id="fullName"
                    label="Full Name"
                    type="text"
                    placeholder="John Doe"
                    icon={User}
                    value={formData.fullName}
                    onChange={handleChange}
                    error={errors.fullName}
                    required
                  />

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
                  <InputField
                    id="phone"
                    label="Phone Number"
                    type="tel"
                    placeholder="123-456-7890"
                    icon={Phone}
                    value={formData.phone}
                    onChange={handleChange}
                    error={errors.phone}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1"
                  >
                    Password <span className="text-error">*</span>
                  </label>
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
                  <p className="text-[11px] text-on-surface-variant px-1">
                    Use at least 6 characters with a mix of letters and numbers.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="confirmPassword"
                    className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1"
                  >
                    Confirm Password <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className={`w-full pl-12 pr-4 py-3 bg-surface-container-highest border-none rounded-lg focus:ring-0 text-sm placeholder:text-outline-variant transition-all border-b-2 ${
                        errors.confirmPassword
                          ? 'border-error focus:border-error'
                          : 'border-transparent focus:border-primary'
                      }`}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-[12px] text-error px-1">{errors.confirmPassword}</p>
                  )}
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
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold text-sm tracking-wide shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isLoading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
                    {!isLoading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </form>
            </div>

            <div className="border-t border-outline-variant/30 px-8 py-6 text-center">
              <p className="text-[11px] text-on-surface-variant">
                By creating an account, you agree to our booking terms and privacy policy.
              </p>
              <p className="text-sm text-on-surface-variant mt-4">
                Already have an account?{' '}
                <Link to="/login" className="text-primary font-bold hover:underline">
                  Sign In
                </Link>
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
