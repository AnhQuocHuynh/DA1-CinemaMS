import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Header } from '../components/Header';
import { authService } from '../services/authService';

export const ResetPassword: React.FC = () => {
  const location = useLocation();
  const [token, setToken] = useState('');
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError('Invalid or missing reset token.');
    }
  }, [location]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Missing reset token.');
      return;
    }

    if (formData.newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      await authService.resetPassword({
        token,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword,
      });
      setSuccess(true);
    } catch (err: any) {
      console.error('❌ [RESET_PASSWORD] Error:', err);
      const errorMessage = err.response?.data?.message || 'Failed to reset password. The token might be expired.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

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
              <div className="mb-10 text-center">
                <span className="text-xl font-black tracking-tighter text-on-surface block mb-2">
                  CinemaArchitect
                </span>
                <h1 className="text-2xl font-semibold tracking-tight text-on-surface">Create New Password</h1>
                <p className="text-on-surface-variant text-sm mt-1">
                  Please enter your new password below.
                </p>
              </div>

              {success ? (
                <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center mb-6">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-green-800 font-bold mb-2">
                    Password Reset Successful
                  </p>
                  <p className="text-sm text-green-700 mb-6">
                    You can now use your new password to log in.
                  </p>
                  <Link
                    to="/login"
                    className="inline-block px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-blue-700"
                  >
                    Go to Login
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="p-4 bg-error/10 border border-error/20 rounded-lg flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-error mt-0.5" />
                      <p className="text-sm text-error">{error}</p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label
                      htmlFor="newPassword"
                      className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1"
                    >
                      New Password <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
                      <input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        placeholder="••••••••"
                        value={formData.newPassword}
                        onChange={handleChange}
                        className="w-full pl-12 pr-4 py-3 bg-surface-container-highest border-none rounded-lg focus:ring-0 text-sm placeholder:text-outline-variant transition-all border-b-2 border-transparent focus:border-primary"
                      />
                    </div>
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
                        className="w-full pl-12 pr-4 py-3 bg-surface-container-highest border-none rounded-lg focus:ring-0 text-sm placeholder:text-outline-variant transition-all border-b-2 border-transparent focus:border-primary"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !token}
                    className="w-full py-4 bg-primary text-on-primary rounded-lg font-bold text-sm tracking-wide shadow-lg shadow-primary/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isLoading ? 'SAVING...' : 'RESET PASSWORD'}
                    {!isLoading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>
              )}
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
    </div>
  );
};
