import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, ArrowRight, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../lib/auth';
import { API_BASE_URL } from '../lib/api';
import appLogo from '../assets/app-logo.png';
import vsbLogo from '../assets/vsb-logo.png';

const loginSchema = z.object({
  email: z.string().min(3, 'Please enter your academic email or registered mobile number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);

  // Pre-warm the backend server & database connection as soon as login screen opens
  useEffect(() => {
    try {
      fetch(`${API_BASE_URL}/health`).catch(() => {});
    } catch {
      // ignore
    }
  }, []);

  // Detect whether running inside the Capacitor mobile app
  const isMobileApp =
    Capacitor.isNativePlatform() ||
    (typeof window !== 'undefined' && window.location.protocol === 'capacitor:');

  const from = location.state?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    try {
      const user = await login(data.email, data.password);

      // Enforce: Mobile app is strictly for Faculty
      if (isMobileApp && user.role === 'ADMIN') {
        await logout();
        setServerError('Mobile application access is strictly for Faculty. Institutional Administrators must use the Web Portal on desktop.');
        return;
      }

      if (user.role === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate(from === '/login' ? '/' : from, { replace: true });
      }
    } catch (err: any) {
      setServerError(
        err.response?.data?.error || err.message || 'Unable to sign in. Please verify your credentials.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans text-[#2b0a10]">
      {/* Top Logos & Brand Title */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <img
            src={appLogo}
            alt="CollegeConnect Logo"
            className="w-16 h-16 object-contain rounded-2xl shadow-sm bg-white p-1 border border-[#ecdcae]"
          />
        </div>
        <p className="text-xs uppercase tracking-[0.2em] font-bold text-maroon-700">
          V.S.B. Engineering College
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-maroon-700 mt-1 leading-tight">
          CollegeConnect
        </h1>
        <p className="mt-1 text-xs text-[#6b5a3a] font-medium">
          {isAdminMode
            ? 'Institutional Administrator Management Portal'
            : 'Faculty-to-Parent Internal Marks Notification System'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-[0_8px_24px_rgba(110,13,28,0.06)] border border-[#ecdcae] rounded-3xl">
          {/* Admin Mode Badge on Website */}
          {isAdminMode && !isMobileApp && (
            <div className="mb-5 pb-3 border-b border-[#ecdcae]/60 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-maroon-700 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-maroon-700" />
                Admin Portal
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAdminMode(false);
                  setServerError(null);
                  setValue('email', '');
                  setValue('password', '');
                }}
                className="text-[11px] font-semibold text-stone-500 hover:text-maroon-700 underline cursor-pointer"
              >
                ← Back to Faculty
              </button>
            </div>
          )}

          {serverError && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                {isAdminMode ? 'Administrator Email' : 'Academic Email or Mobile Number'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  autoComplete="username"
                  placeholder={isAdminMode ? 'admin@college.edu' : 'faculty@college.edu or 9876543210'}
                  {...register('email')}
                  className="w-full px-4 py-3 min-h-[48px] bg-[#fdfbef] border border-[#ecdcae] rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-maroon-700 focus:border-transparent transition-all"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                Password
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password')}
                  className="w-full pl-4 pr-11 py-3 min-h-[48px] bg-[#fdfbef] border border-[#ecdcae] rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-maroon-700 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 p-1.5 text-stone-500 hover:text-maroon-700 focus:outline-none transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5 text-stone-500" />
                  ) : (
                    <Eye className="w-5 h-5 text-stone-500" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[50px] rounded-full bg-gradient-to-r from-maroon-700 to-maroon-800 hover:from-maroon-800 hover:to-maroon-900 text-gold-300 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>
                {isSubmitting
                  ? 'Signing In...'
                  : isAdminMode
                  ? 'Sign In as Administrator'
                  : 'Sign In to Portal'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>


        </div>

        {/* Website Only: Single Discreet Link at the bottom before login */}
        {!isMobileApp && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                const next = !isAdminMode;
                setIsAdminMode(next);
                setServerError(null);
                setValue('email', '');
                setValue('password', '');
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-maroon-700 underline underline-offset-4 transition-colors cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{isAdminMode ? '← Back to Faculty Portal' : 'Admin Portal'}</span>
            </button>
          </div>
        )}

        <p className="mt-4 text-center text-xs text-[#6b5a3a] font-medium">
          Karur - 639 111, Tamil Nadu, India
        </p>
      </div>
    </div>
  );
};
