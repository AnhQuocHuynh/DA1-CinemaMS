import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { InputField } from '../components/InputField';
import { Header } from '../components/Header';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email');
      return;
    }

    setIsLoading(true);
    
    // TODO: Uncomment for real implementation
    // try {
    //   const response = await axios.post(`${API_BASE_URL}/auth/forgot-password`, { email });
    //   console.log('Password reset email sent:', response.data);
    //   setSuccess(true);
    // } catch (error) {
    //   setError('Failed to send reset email. Please try again.');
    // }

    console.log('📧 [FORGOT_PASSWORD] Sending reset email to:', email);
    setSuccess(true);
    console.log('✅ [FORGOT_PASSWORD] Reset email sent successfully');
    
    setIsLoading(false);
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
                <h1 className="text-2xl font-semibold tracking-tight text-on-surface">Reset Password</h1>
                <p className="text-on-surface-variant text-sm mt-1">
                  Enter your email to receive a password reset link.
                </p>
              </div>

              {success ? (
                <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center mb-6">
                  <p className="text-green-800 mb-4">
                    ✅ Password reset link sent to {email}
                  </p>
                  <p className="text-sm text-green-700 mb-4">
                    Please check your email and follow the instructions to reset your password.
                  </p>
                  <Link
                    to="/login"
                    className="inline-block px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-blue-700"
                  >
                    Back to Login
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

                  <InputField
                    id="email"
                    label="Email Address"
                    type="email"
                    placeholder="name@company.com"
                    icon={Mail}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 bg-primary text-on-primary rounded-lg font-bold text-sm tracking-wide shadow-lg shadow-primary/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isLoading ? 'SENDING...' : 'SEND RESET LINK'}
                    {!isLoading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>
              )}

              <div className="mt-8 pt-8 border-t border-outline-variant/30 text-center">
                <p className="text-sm text-on-surface-variant">
                  Remember your password?{' '}
                  <Link to="/login" className="text-primary font-bold hover:underline">
                    Sign In
                  </Link>
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
