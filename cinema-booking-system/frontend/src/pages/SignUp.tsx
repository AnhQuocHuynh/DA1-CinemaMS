import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, AlertCircle } from 'lucide-react';
import { InputField } from '../components/InputField';
import { Header } from '../components/Header';

interface SignUpFormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<SignUpFormData>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
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

    // TODO: Uncomment for real implementation
    // try {
    //   const response = await axios.post(`${API_BASE_URL}/auth/signup`, {
    //     fullName: formData.fullName,
    //     email: formData.email,
    //     password: formData.password,
    //   });
    //   console.log('Account created successfully:', response.data);
    //   navigate('/login');
    // } catch (error) {
    //   setGeneralError('Failed to create account. Email may already be in use.');
    // }

    console.log('📝 [SIGNUP] Creating account:', {
      fullName: formData.fullName,
      email: formData.email,
    });
    
    setTimeout(() => {
      console.log('✅ [SIGNUP] Account created successfully');
      navigate('/login');
    }, 1000);

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
                <h1 className="text-2xl font-semibold tracking-tight text-on-surface">Create Account</h1>
                <p className="text-on-surface-variant text-sm mt-1">
                  Join us to start booking your favorite movies.
                </p>
              </div>

              {generalError && (
                <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-error mt-0.5" />
                  <p className="text-sm text-error">{generalError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
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

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 bg-primary text-on-primary rounded-lg font-bold text-sm tracking-wide shadow-lg shadow-primary/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isLoading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
                    {!isLoading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </form>

              <div className="mt-8 pt-8 border-t border-outline-variant/30 text-center">
                <p className="text-sm text-on-surface-variant">
                  Already have an account?{' '}
                  <Link to="/login" className="text-primary font-bold hover:underline">
                    Sign In
                  </Link>
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
    </div>
  );
};
