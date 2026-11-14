import React, { useState } from 'react';
import { Lock, Mail, User as UserIcon, ArrowRight, UserPlus, LogIn, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both staff email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.auth.login(email, password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please check your staff email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setError('Please fill in all registration fields.');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.auth.register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        department_id: 'dept-it'
      });
      setSuccessMsg('Faculty account created successfully! Signing in...');
      setTimeout(() => {
        onLoginSuccess(res.user);
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Registration failed. This staff email may already exist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root-container">
      <style>{`
        .login-root-container {
          position: relative;
          min-height: 100vh;
          width: 100vw;
          background-color: #24080f;
          background-image: 
            radial-gradient(ellipse at 50% 35%, rgba(45, 12, 20, 0.15) 0%, rgba(15, 3, 7, 0.94) 100%),
            repeating-conic-gradient(from 45deg, #c29649 0deg 90deg, #2a0c14 90deg 180deg, #c29649 180deg 270deg, #2a0c14 270deg 360deg);
          background-size: 100% 100%, 54px 54px;
          background-position: center center, center center;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          overflow-x: hidden;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        }

        .login-emblem-wrap {
          position: relative;
          width: 160px;
          height: 160px;
          margin: 0 auto 16px auto;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .login-halo {
          position: absolute;
          inset: -20%;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(246, 200, 76, 0.45) 0%, rgba(122, 26, 44, 0.5) 45%, transparent 72%);
        }

        .login-beads {
          position: absolute;
          inset: -6%;
          width: 112%;
          height: 112%;
          animation: login-spin 45s linear infinite;
        }

        .login-beads circle {
          fill: none;
          stroke: url(#gg-login-beads);
          stroke-width: 3;
          stroke-linecap: round;
          stroke-dasharray: 0 10;
          opacity: 0.85;
        }

        .login-sparkle {
          position: absolute;
          pointer-events: none;
          z-index: 4;
          filter: drop-shadow(0 0 6px rgba(255, 243, 184, 0.95));
        }

        .login-sparkle.sp-1 { top: 4%; right: 14%; width: 22px; height: 22px; animation: login-twinkle 2.2s 0.2s ease-in-out infinite; }
        .login-sparkle.sp-2 { top: 18%; left: 4%; width: 18px; height: 18px; animation: login-twinkle 2.5s 0.8s ease-in-out infinite; }
        .login-sparkle.sp-3 { bottom: 18%; right: 2%; width: 20px; height: 20px; animation: login-twinkle 2.1s 0.5s ease-in-out infinite; }
        .login-sparkle.sp-4 { bottom: 6%; left: 10%; width: 17px; height: 17px; animation: login-twinkle 2.7s 1.1s ease-in-out infinite; }

        @keyframes login-spin {
          to { transform: rotate(360deg); }
        }

        @keyframes login-twinkle {
          0%, 100% { transform: scale(0.7) rotate(0deg); opacity: 0.5; }
          50% { transform: scale(1.2) rotate(90deg); opacity: 1; }
        }

        .login-glass-card {
          background: rgba(22, 6, 12, 0.92);
          border: 1px solid rgba(246, 200, 76, 0.35);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.75), 0 0 30px rgba(246, 200, 76, 0.12);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
      `}</style>

      {/* SVG Definitions */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="gg-login-beads" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff3b8" />
            <stop offset="50%" stopColor="#f6c84c" />
            <stop offset="100%" stopColor="#c08a16" />
          </linearGradient>
        </defs>
      </svg>

      <div className="max-w-md w-full relative z-10 my-auto">
        {/* Diamond Argyle Center Emblem with Glowing Rings & Sparkles */}
        <div className="login-emblem-wrap">
          <div className="login-halo" />

          {/* Dotted Golden Ring */}
          <svg className="login-beads" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="92" />
          </svg>

          {/* 4-Point Sparkle Stars */}
          <svg className="login-sparkle sp-1" viewBox="0 0 24 24" fill="#fff3b8">
            <path d="M12 0 L14 9 L23 12 L14 15 L12 24 L10 15 L1 12 L10 9 Z" />
          </svg>
          <svg className="login-sparkle sp-2" viewBox="0 0 24 24" fill="#f6c84c">
            <path d="M12 0 L14 9 L23 12 L14 15 L12 24 L10 15 L1 12 L10 9 Z" />
          </svg>
          <svg className="login-sparkle sp-3" viewBox="0 0 24 24" fill="#fff3b8">
            <path d="M12 0 L14 9 L23 12 L14 15 L12 24 L10 15 L1 12 L10 9 Z" />
          </svg>
          <svg className="login-sparkle sp-4" viewBox="0 0 24 24" fill="#f6c84c">
            <path d="M12 0 L14 9 L23 12 L14 15 L12 24 L10 15 L1 12 L10 9 Z" />
          </svg>

          {/* College Logo */}
          <img
            src="/vsb-logo.png"
            alt="V.S.B. Engineering College Emblem"
            className="w-32 h-32 object-contain relative z-10 drop-shadow-[0_12px_22px_rgba(0,0,0,0.85)] drop-shadow-[0_0_16px_rgba(246,200,76,0.6)]"
          />
        </div>

        {/* Portal Titles */}
        <div className="text-center mb-5">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#fff3b8] via-[#f6c84c] to-[#c08a16] font-display drop-shadow">
            CollegeMarks Portal
          </h1>
          <p className="text-xs text-[#F6C84C] font-bold tracking-widest uppercase mt-1">
            V.S.B. Engineering College, Karur
          </p>
          <p className="text-[11px] text-[#fbeec4]/75 mt-0.5">
            Internal Examination Marks & Parent Notification System
          </p>
        </div>

        {/* Glassmorphism Card */}
        <div className="login-glass-card rounded-3xl p-6 sm:p-7 border border-[#F6C84C]/35 shadow-2xl">
          {/* Faculty Login & New Register Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 rounded-2xl mb-5 border border-[#EADFD3]/15">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-gradient-to-r from-[#7A1A2C] to-[#4A101E] text-[#fff3b8] shadow-md border border-[#F6C84C]/40'
                  : 'text-[#fbeec4]/70 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5 text-[#F6C84C]" />
              <span>Faculty Login</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-gradient-to-r from-[#7A1A2C] to-[#4A101E] text-[#fff3b8] shadow-md border border-[#F6C84C]/40'
                  : 'text-[#fbeec4]/70 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 text-[#F6C84C]" />
              <span>New Register</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-2xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'login' ? (
            /* FACULTY LOGIN FORM */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[#F6C84C] uppercase tracking-wider mb-1.5">
                  Staff Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#F6C84C]/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="faculty@college.edu"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#C08A16]/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#F6C84C] text-[#fff3b8] bg-black/50 placeholder:text-white/30"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#F6C84C] uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#F6C84C]/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#C08A16]/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#F6C84C] text-[#fff3b8] bg-black/50 placeholder:text-white/30"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#F6C84C] to-[#C08A16] hover:from-[#fff3b8] hover:to-[#e8b23a] text-[#2B1B1B] font-extrabold text-sm shadow-lg shadow-[#F6C84C]/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 border border-white/40 cursor-pointer mt-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-[#2B1B1B] border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Sign In to Portal</span>
                    <ArrowRight className="w-4 h-4 text-[#2B1B1B]" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className="text-xs text-[#fbeec4]/70 hover:text-[#F6C84C] transition-colors cursor-pointer"
                >
                  New faculty member? <span className="font-bold underline text-[#F6C84C]">Register here →</span>
                </button>
              </div>
            </form>
          ) : (
            /* NEW FACULTY REGISTER FORM */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-[#F6C84C] uppercase tracking-wider mb-1.5">
                  Faculty Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#F6C84C]/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Prof. S. Ramesh"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#C08A16]/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#F6C84C] text-[#fff3b8] bg-black/50 placeholder:text-white/30"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#F6C84C] uppercase tracking-wider mb-1.5">
                  Staff Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#F6C84C]/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="ramesh@college.edu"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#C08A16]/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#F6C84C] text-[#fff3b8] bg-black/50 placeholder:text-white/30"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#F6C84C] uppercase tracking-wider mb-1.5">
                  Create Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#F6C84C]/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#C08A16]/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#F6C84C] text-[#fff3b8] bg-black/50 placeholder:text-white/30"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#F6C84C] uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#F6C84C]/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#C08A16]/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#F6C84C] text-[#fff3b8] bg-black/50 placeholder:text-white/30"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#F6C84C] to-[#C08A16] hover:from-[#fff3b8] hover:to-[#e8b23a] text-[#2B1B1B] font-extrabold text-sm shadow-lg shadow-[#F6C84C]/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 border border-white/40 cursor-pointer mt-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-[#2B1B1B] border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Create Faculty Account</span>
                    <ArrowRight className="w-4 h-4 text-[#2B1B1B]" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="text-xs text-[#fbeec4]/70 hover:text-[#F6C84C] transition-colors cursor-pointer"
                >
                  Already registered? <span className="font-bold underline text-[#F6C84C]">Sign In →</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Security / Autonomous Notice */}
        <div className="text-center mt-5 text-[11px] text-[#fbeec4]/75 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#F6C84C]" />
          <span>V.S.B. Engineering College • Autonomous Institution</span>
        </div>
      </div>
    </div>
  );
};
