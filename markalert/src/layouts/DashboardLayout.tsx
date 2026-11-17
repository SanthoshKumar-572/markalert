import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSpreadsheet,
  History,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  ChevronRight,
  BookOpen,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import clsx from 'clsx';
import BottomNav from '../components/BottomNav';
import appLogo from '../assets/app-logo.png';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all min-h-[44px]',
      isActive
        ? 'bg-[#7A1A2C] text-white shadow-xs font-bold'
        : 'text-stone-700 hover:text-[#7A1A2C] hover:bg-stone-100/80'
    );

  // Active tab ID for mobile bottom navigation
  const currentPath = location.pathname;
  let activeNavId = 'home';
  if (currentPath.startsWith('/upload') || currentPath.startsWith('/batches') || currentPath.startsWith('/subject-marks')) {
    activeNavId = 'marks';
  } else if (currentPath.startsWith('/history')) {
    activeNavId = 'messages';
  } else if (currentPath.startsWith('/settings') || currentPath.startsWith('/admin')) {
    activeNavId = 'profile';
  }

  const handleBottomNavChange = (id: string) => {
    switch (id) {
      case 'home':
        navigate('/');
        break;
      case 'marks':
        navigate('/upload');
        break;
      case 'messages':
        navigate('/history');
        break;
      case 'profile':
        navigate('/settings');
        break;
      default:
        navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-stone-900 font-sans flex flex-col lg:flex-row">
      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-stone-900/40 z-40 lg:hidden backdrop-blur-xs"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar for Desktop & Mobile Drawer */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-stone-200/90 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static shadow-xs',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header: Clean Unified Pure White */}
        <div className="h-20 px-5 border-b border-stone-200/80 flex items-center justify-between bg-white text-stone-900">
          <div className="flex items-center gap-3">
            <img src={appLogo} alt="CollegeConnect" className="w-10 h-10 object-contain rounded-xl bg-stone-50 border border-stone-200/80 p-1 shadow-2xs" />
            <div>
              <span className="font-display font-bold text-lg tracking-wide text-[#7A1A2C] block leading-tight">
                CollegeConnect
              </span>
              <span className="text-[11px] text-stone-500 font-semibold block">
                V.S.B. Engineering College
              </span>
            </div>
          </div>
          <button
            className="lg:hidden text-stone-400 hover:text-stone-700 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 px-3.5 py-5 space-y-6 overflow-y-auto">
          {/* Main Faculty Section */}
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-bold text-[#7A1A2C] uppercase tracking-wider mb-2">
              Examination & Marks
            </p>
            <NavLink to="/" end className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Dashboard Overview</span>
            </NavLink>
            <NavLink to="/upload" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>Upload Marks Sheet</span>
            </NavLink>
            <NavLink to="/subject-marks" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>Subject Performance</span>
            </NavLink>
            <NavLink to="/history" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
              <History className="w-4 h-4 shrink-0" />
              <span>Notification History</span>
            </NavLink>
          </div>

          {/* Admin Management Section */}
          {isAdmin && (
            <div className="space-y-1">
              <p className="px-3 text-[11px] font-bold text-[#7A1A2C] uppercase tracking-wider mb-2">
                Administration
              </p>
              <NavLink to="/admin" end className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Admin Portal</span>
              </NavLink>
              <NavLink to="/settings" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                <Settings className="w-4 h-4 shrink-0" />
                <span>System Settings</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-stone-200/90 bg-stone-50/80">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-[#7A1A2C] text-[#F6C84C] font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                {user?.full_name?.slice(0, 2).toUpperCase() || 'FC'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-stone-900 truncate">
                  {user?.full_name || 'Faculty Member'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={clsx(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider',
                      isAdmin ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                    )}
                  >
                    {user?.role}
                  </span>
                  <span className="text-[10px] text-stone-500 truncate font-mono">
                    {user?.employee_id}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-[11px] text-stone-600 font-medium">
                  <Smartphone className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="truncate">
                    {user?.mobile_number ? `+91 ${user.mobile_number}` : 'Sync Mobile'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar: Clean White with Maroon accents */}
        <header className="h-16 bg-white border-b border-stone-200/80 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <button
            className="lg:hidden text-[#7A1A2C] hover:text-[#5c1321] p-2 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2 lg:hidden">
            <span className="font-display font-bold text-[#7A1A2C] text-lg">
              CollegeConnect
            </span>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {user?.mobile_number && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>+91 {user.mobile_number}</span>
              </span>
            )}
            <span className="text-xs font-semibold text-stone-600 hidden md:inline">
              {user?.department || 'V.S.B. Engineering College, Karur'}
            </span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs ring-4 ring-emerald-50" title="System Online & Connected" />
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-y-auto pb-8">
          {children}
        </main>
      </div>
    </div>
  );
};
